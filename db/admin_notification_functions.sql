-- Add admin notification functions
-- This migration adds functions for admin notification management without affecting existing system

-- Function to create a notification and queue it for delivery (compatible with existing tables)
CREATE OR REPLACE FUNCTION public.admin_send_notification(
  p_user_ids uuid[],
  p_title text,
  p_message text,
  p_channels text[] DEFAULT ARRAY['push', 'inapp'],
  p_priority text DEFAULT 'normal',
  p_type text DEFAULT 'admin_message',
  p_scheduled_for timestamptz DEFAULT now()
) RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_notification_id uuid;
  v_channel text;
  v_result jsonb;
  v_notifications_created integer := 0;
  v_queue_items_created integer := 0;
BEGIN
  -- Validate inputs
  IF array_length(p_user_ids, 1) IS NULL OR array_length(p_user_ids, 1) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No user IDs provided');
  END IF;
  
  IF p_title IS NULL OR trim(p_title) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Title is required');
  END IF;
  
  IF p_message IS NULL OR trim(p_message) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Message is required');
  END IF;

  -- Loop through each user
  FOREACH v_user_id IN ARRAY p_user_ids LOOP
    -- Create notification record
    INSERT INTO public.notifications (user_id, type, title, message, category, data)
    VALUES (
      v_user_id,
      p_type,
      p_title,
      p_message,
      'system',
      jsonb_build_object(
        'priority', p_priority,
        'sent_by_admin', true,
        'channels', p_channels
      )
    )
    RETURNING id INTO v_notification_id;
    
    v_notifications_created := v_notifications_created + 1;
    
    -- Queue for each channel
    FOREACH v_channel IN ARRAY p_channels LOOP
      INSERT INTO public.notification_outbox (
        notification_id,
        user_id,
        channel,
        payload,
        type,
        title,
        body,
        priority,
        scheduled_for
      ) VALUES (
        v_notification_id,
        v_user_id,
        v_channel,
        jsonb_build_object(
          'title', p_title,
          'body', p_message,
          'data', jsonb_build_object(
            'priority', p_priority,
            'category', 'system',
            'type', p_type
          )
        ),
        'general',
        p_title,
        p_message,
        p_priority,
        p_scheduled_for
      );
      
      v_queue_items_created := v_queue_items_created + 1;
    END LOOP;
  END LOOP;

  -- Return success with stats
  v_result := jsonb_build_object(
    'success', true,
    'notifications_created', v_notifications_created,
    'queue_items_created', v_queue_items_created,
    'users_targeted', array_length(p_user_ids, 1),
    'channels', p_channels
  );
  
  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get notification analytics for admin dashboard
CREATE OR REPLACE FUNCTION public.admin_get_notification_stats(
  p_days integer DEFAULT 7
) RETURNS jsonb AS $$
DECLARE
  v_total_sent integer;
  v_delivered integer;
  v_failed integer;
  v_pending integer;
  v_stats jsonb;
BEGIN
  -- Get stats from the specified number of days
  SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN status = 'sent' THEN 1 END) as delivered,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
    COUNT(CASE WHEN status = 'queued' THEN 1 END) as pending
  INTO v_total_sent, v_delivered, v_failed, v_pending
  FROM notification_outbox
  WHERE created_at >= (now() - (p_days || ' days')::interval);

  -- Build result
  v_stats := jsonb_build_object(
    'period_days', p_days,
    'total_sent', v_total_sent,
    'delivered', v_delivered,
    'failed', v_failed,
    'pending', v_pending,
    'delivery_rate', CASE 
      WHEN v_total_sent > 0 THEN ROUND((v_delivered::numeric / v_total_sent * 100), 2)
      ELSE 0 
    END
  );
  
  RETURN v_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get failed notifications for admin review
CREATE OR REPLACE FUNCTION public.admin_get_failed_notifications(
  p_limit integer DEFAULT 50
) RETURNS TABLE (
  id uuid,
  title text,
  body text,
  user_name text,
  user_email text,
  error text,
  attempts integer,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    no.id,
    no.title,
    no.body,
    COALESCE(p.full_name, 'Unknown User') as user_name,
    COALESCE(p.email, '') as user_email,
    COALESCE(no.error, 'Unknown error') as error,
    no.attempts,
    no.created_at
  FROM notification_outbox no
  LEFT JOIN profiles p ON no.user_id = p.id
  WHERE no.status = 'failed'
  ORDER BY no.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to retry failed notifications
CREATE OR REPLACE FUNCTION public.admin_retry_notifications(
  p_notification_ids uuid[]
) RETURNS jsonb AS $$
DECLARE
  v_updated integer;
BEGIN
  -- Reset failed notifications to queued
  UPDATE notification_outbox 
  SET 
    status = 'queued',
    error = NULL,
    retry_count = COALESCE(retry_count, 0) + 1,
    scheduled_for = now()
  WHERE id = ANY(p_notification_ids)
    AND status = 'failed';
    
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', true,
    'queued_for_retry', v_updated
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users (admin check will be done in application layer)
GRANT EXECUTE ON FUNCTION public.admin_send_notification TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_notification_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_failed_notifications TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_retry_notifications TO authenticated;