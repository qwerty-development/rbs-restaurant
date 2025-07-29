// app/(dashboard)/reviews/page.tsx
"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "react-hot-toast"
import { 
  Star, 
  MessageSquare, 
  ThumbsUp,
  Filter,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle
} from "lucide-react"
import type { Review } from "@/types"
import { cn } from "@/lib/utils"

export default function ReviewsPage() {
  const [selectedReview, setSelectedReview] = useState<Review | null>(null)
  const [replyText, setReplyText] = useState("")
  const [ratingFilter, setRatingFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [replying, setReplying] = useState(false)
  
  const supabase = createClient()

  // Get restaurant ID
  const [restaurantId, setRestaurantId] = useState<string>("")
  
  useEffect(() => {
    async function getRestaurantId() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: staffData } = await supabase
          .from("restaurant_staff")
          .select("restaurant_id")
          .eq("user_id", user.id)
          .single()
        
        if (staffData) {
          setRestaurantId(staffData.restaurant_id)
        }
      }
    }
    getRestaurantId()
  }, [supabase])

  // Fetch reviews
  const { data: reviews, isLoading, refetch } = useQuery({
    queryKey: ["reviews", restaurantId, ratingFilter, statusFilter],
    queryFn: async () => {
      if (!restaurantId) return []
      
      let query = supabase
        .from("reviews")
        .select(`
          *,
          user:profiles(full_name, avatar_url),
          booking:bookings(booking_time, party_size)
        `)
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false })

      // Rating filter
      if (ratingFilter !== "all") {
        query = query.eq("rating", parseInt(ratingFilter))
      }

      // Status filter
      if (statusFilter === "replied") {
        query = query.not("reply", "is", null)
      } else if (statusFilter === "pending") {
        query = query.is("reply", null)
      }

      const { data, error } = await query

      if (error) throw error
      return data as Review[]
    },
    enabled: !!restaurantId,
  })

  // Reply to review
  const handleReply = async () => {
    if (!selectedReview || !replyText.trim()) return

    try {
      setReplying(true)
      const { error } = await supabase
        .from("reviews")
        .update({ 
          reply: replyText,
          reply_date: new Date().toISOString(),
        })
        .eq("id", selectedReview.id)

      if (error) throw error

      toast.success("Reply posted successfully")
      setSelectedReview(null)
      setReplyText("")
      refetch()
    } catch (error) {
      toast.error("Failed to post reply")
    } finally {
      setReplying(false)
    }
  }

  // Calculate statistics
  const getReviewStats = () => {
    if (!reviews || reviews.length === 0) {
      return {
        total: 0,
        average: 0,
        distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        replied: 0,
        pending: 0,
        trend: 0,
      }
    }

    const distribution = reviews.reduce((acc, review) => {
      acc[review.rating] = (acc[review.rating] || 0) + 1
      return acc
    }, {} as Record<number, number>)

    const average = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    const replied = reviews.filter((r:any) => r.reply).length
    const pending = reviews.filter((r:any) => !r.reply).length

    // Calculate trend (compare last 30 days to previous 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const sixtyDaysAgo = new Date()
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

    const recentReviews = reviews.filter(r => 
      new Date(r.created_at) > thirtyDaysAgo
    )
    const previousReviews = reviews.filter(r => 
      new Date(r.created_at) > sixtyDaysAgo && 
      new Date(r.created_at) <= thirtyDaysAgo
    )

    const recentAvg = recentReviews.length > 0
      ? recentReviews.reduce((sum, r) => sum + r.rating, 0) / recentReviews.length
      : 0
    const previousAvg = previousReviews.length > 0
      ? previousReviews.reduce((sum, r) => sum + r.rating, 0) / previousReviews.length
      : 0

    const trend = recentAvg - previousAvg

    return {
      total: reviews.length,
      average,
      distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0, ...distribution },
      replied,
      pending,
      trend,
    }
  }

  const stats:any = getReviewStats()

  // Render star rating
  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={cn(
          "h-4 w-4",
          i < rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
        )}
      />
    ))
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reviews</h1>
        <p className="text-muted-foreground">
          Manage and respond to customer reviews
        </p>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.average.toFixed(1)}</div>
            <div className="flex items-center gap-1 mt-1">
              {stats.trend > 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : stats.trend < 0 ? (
                <TrendingDown className="h-4 w-4 text-red-600" />
              ) : null}
              <p className="text-xs text-muted-foreground">
                {stats.trend > 0 ? "+" : ""}{stats.trend.toFixed(1)} from last month
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reviews</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              All time
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.total > 0 ? Math.round((stats.replied / stats.total) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.replied} replied
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Reply</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">
              Need response
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Rating Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Rating Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((rating) => {
              const count = stats.distribution[rating] || 0
              const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0
              
              return (
                <div key={rating} className="flex items-center gap-3">
                  <div className="flex items-center gap-1 w-20">
                    <span className="text-sm font-medium">{rating}</span>
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  </div>
                  <div className="flex-1">
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-yellow-400 transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground w-12 text-right">
                    {count}
                  </span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Customer Reviews</CardTitle>
            <div className="flex gap-2">
              <Select value={ratingFilter} onValueChange={setRatingFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Ratings</SelectItem>
                  <SelectItem value="5">5 Stars</SelectItem>
                  <SelectItem value="4">4 Stars</SelectItem>
                  <SelectItem value="3">3 Stars</SelectItem>
                  <SelectItem value="2">2 Stars</SelectItem>
                  <SelectItem value="1">1 Star</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Reviews</SelectItem>
                  <SelectItem value="replied">Replied</SelectItem>
                  <SelectItem value="pending">Pending Reply</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading reviews...</div>
          ) : reviews?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No reviews found
            </div>
          ) : (
            <div className="space-y-4">
              {reviews?.map((review:any) => (
                <Card key={review.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-3">
                        <Avatar>
                          <AvatarImage src={review.user?.avatar_url} />
                          <AvatarFallback>
                            {review.user?.full_name?.split(" ").map((n: any[]) => n[0]).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{review.user?.full_name}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex">{renderStars(review.rating)}</div>
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(review.created_at), "MMM d, yyyy")}
                            </span>
                          </div>
                          {review.booking && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Party of {review.booking.party_size} • {format(new Date(review.booking.booking_time), "MMM d")}
                            </div>
                          )}
                        </div>
                      </div>
                      {review.is_verified && (
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Verified
                        </Badge>
                      )}
                    </div>

                    <p className="text-sm mb-3">{review.comment}</p>

                    {review.reply ? (
                      <div className="bg-muted/50 rounded-lg p-4 mt-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">Restaurant Response</Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(review.reply_date), "MMM d, yyyy")}
                          </span>
                        </div>
                        <p className="text-sm">{review.reply}</p>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedReview(review)}
                      >
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Reply
                      </Button>
                    )}

                    {review.helpful_count > 0 && (
                      <div className="flex items-center gap-1 mt-3 text-sm text-muted-foreground">
                        <ThumbsUp className="h-4 w-4" />
                        {review.helpful_count} found this helpful
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reply Dialog */}
      <Dialog open={!!selectedReview} onOpenChange={() => {
        setSelectedReview(null)
        setReplyText("")
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reply to Review</DialogTitle>
            <DialogDescription>
              Respond professionally to customer feedback
            </DialogDescription>
          </DialogHeader>
          {selectedReview && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={selectedReview.user?.avatar_url} />
                    <AvatarFallback>
                      {selectedReview.user?.full_name?.split(" ").map(n => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium text-sm">{selectedReview.user?.full_name}</div>
                    <div className="flex">{renderStars(selectedReview.rating)}</div>
                  </div>
                </div>
                <p className="text-sm">{selectedReview.comment}</p>
              </div>

              <Textarea
                placeholder="Write your response..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={4}
              />

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedReview(null)
                    setReplyText("")
                  }}
                  disabled={replying}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleReply}
                  disabled={replying || !replyText.trim()}
                >
                  {replying ? "Posting..." : "Post Reply"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}