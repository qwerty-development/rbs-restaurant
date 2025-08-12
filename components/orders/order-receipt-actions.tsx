"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu"
import { getPrintService } from "@/lib/services/print-service"
import { createClient } from "@/lib/supabase/client"
import { Receipt, ChevronDown, FileText, Printer, Download } from "lucide-react"
import { toast } from "react-hot-toast"

interface OrderReceiptActionsProps {
  order: any
  booking?: any
  className?: string
}

export function OrderReceiptActions({ order, booking, className }: OrderReceiptActionsProps) {
  const [isPrinting, setIsPrinting] = useState(false)
  const supabase = createClient()

  const handlePrintOrderReceipt = async () => {
    setIsPrinting(true)
    try {
      const printService = getPrintService()
      
      // Get booking info if not provided
      let bookingData = booking
      if (!bookingData && order.booking_id) {
        const { data, error } = await supabase
          .from('bookings')
          .select(`
            *,
            booking_tables(
              table:restaurant_tables(table_number)
            )
          `)
          .eq('id', order.booking_id)
          .single()

        if (!error && data) {
          bookingData = data
        }
      }

      // Get order items
      const { data: orderItems, error: itemsError } = await supabase
        .from('order_items')
        .select(`
          *,
          menu_item:menu_items(name, price)
        `)
        .eq('order_id', order.id)

      if (itemsError) {
        throw new Error('Failed to fetch order items')
      }

      const receiptData = {
        order_id: order.id,
        order_number: order.order_number,
        guest_name: bookingData?.guest_name || 'Guest',
        table_number: bookingData?.booking_tables?.[0]?.table?.table_number || 'N/A',
        order_items: orderItems || [],
        subtotal: order.subtotal,
        tax_amount: order.tax_amount,
        total_amount: order.total_amount,
        special_instructions: order.special_instructions
      }

      await printService.printOrderReceipt(receiptData)
      toast.success("Order receipt printed!")

    } catch (error: any) {
      console.error('Error printing order receipt:', error)
      toast.error(error.message || "Failed to print receipt")
    } finally {
      setIsPrinting(false)
    }
  }

  const handlePrintCustomerReceipt = async () => {
    if (!order.booking_id) {
      toast.error("No booking associated with this order")
      return
    }

    setIsPrinting(true)
    try {
      const printService = getPrintService()
      
      // Get complete booking with all orders
      const { data: bookingData, error } = await supabase
        .from('bookings')
        .select(`
          *,
          booking_tables(
            table:restaurant_tables(table_number)
          ),
          orders(
            *,
            order_items(
              *,
              menu_item:menu_items(name, price)
            )
          )
        `)
        .eq('id', order.booking_id)
        .single()

      if (error || !bookingData) {
        throw new Error('Failed to fetch booking information')
      }

      const receiptData = {
        booking_id: bookingData.id,
        guest_name: bookingData.guest_name || 'Guest',
        party_size: bookingData.party_size,
        table_number: bookingData.booking_tables?.[0]?.table?.table_number || 'N/A',
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        orders: bookingData.orders || [],
        include_itemized: true,
        include_payment_summary: true
      }

      await printService.printReceipt(receiptData)
      toast.success("Customer receipt printed!")

    } catch (error: any) {
      console.error('Error printing customer receipt:', error)
      toast.error(error.message || "Failed to print customer receipt")
    } finally {
      setIsPrinting(false)
    }
  }

  const handlePrintKitchenSummary = async () => {
    if (!order.booking_id) {
      toast.error("No booking associated with this order")
      return
    }

    setIsPrinting(true)
    try {
      const printService = getPrintService()
      
      // Get booking info
      const { data: bookingData, error } = await supabase
        .from('bookings')
        .select(`
          *,
          booking_tables(
            table:restaurant_tables(table_number)
          ),
          orders(*)
        `)
        .eq('id', order.booking_id)
        .single()

      if (error || !bookingData) {
        throw new Error('Failed to fetch booking information')
      }

      const summaryData = {
        booking_id: bookingData.id,
        guest_name: bookingData.guest_name || 'Guest',
        table_number: bookingData.booking_tables?.[0]?.table?.table_number || 'N/A',
        orders: bookingData.orders || [],
        completion_time: new Date().toLocaleTimeString(),
        include_timing: true,
        include_notes: true
      }

      await printService.printKitchenSummary(summaryData)
      toast.success("Kitchen summary printed!")

    } catch (error: any) {
      console.error('Error printing kitchen summary:', error)
      toast.error(error.message || "Failed to print kitchen summary")
    } finally {
      setIsPrinting(false)
    }
  }

  // Show simple print button for orders that can be printed
  if (!['served', 'completed'].includes(order.status)) {
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isPrinting}
          className={className}
        >
          <Receipt className="h-4 w-4 mr-2" />
          Print
          <ChevronDown className="h-4 w-4 ml-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={handlePrintOrderReceipt} disabled={isPrinting}>
          <Printer className="h-4 w-4 mr-2" />
          Order Receipt
          <Badge variant="secondary" className="ml-auto text-xs">
            Single Order
          </Badge>
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={handlePrintCustomerReceipt} disabled={isPrinting}>
          <Receipt className="h-4 w-4 mr-2" />
          Customer Receipt
          <Badge variant="secondary" className="ml-auto text-xs">
            Full Bill
          </Badge>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={handlePrintKitchenSummary} disabled={isPrinting}>
          <FileText className="h-4 w-4 mr-2" />
          Kitchen Summary
          <Badge variant="outline" className="ml-auto text-xs">
            Internal
          </Badge>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Simple print button for quick access
export function QuickPrintButton({ order, className }: { order: any; className?: string }) {
  const [isPrinting, setIsPrinting] = useState(false)
  const supabase = createClient()

  const handleQuickPrint = async () => {
    setIsPrinting(true)
    try {
      const printService = getPrintService()
      
      // Get basic order data for quick print
      const { data: orderItems } = await supabase
        .from('order_items')
        .select(`
          *,
          menu_item:menu_items(name, price)
        `)
        .eq('order_id', order.id)

      const { data: booking }:any = await supabase
        .from('bookings')
        .select(`
          guest_name,
          booking_tables(
            table:restaurant_tables(table_number)
          )
        `)
        .eq('id', order.booking_id)
        .single()

      const receiptData:any = {
        order_id: order.id,
        order_number: order.order_number,
        guest_name: booking?.guest_name || 'Guest',
        table_number: booking?.booking_tables?.[0]?.table?.table_number || 'N/A',
        order_items: orderItems || [],
        subtotal: order.subtotal,
        tax_amount: order.tax_amount,
        total_amount: order.total_amount,
        special_instructions: order.special_instructions
      }

      await printService.printOrderReceipt(receiptData)
      toast.success("Receipt printed!")

    } catch (error: any) {
      console.error('Error printing receipt:', error)
      toast.error("Failed to print receipt")
    } finally {
      setIsPrinting(false)
    }
  }

  if (!['served', 'completed'].includes(order.status)) {
    return null
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleQuickPrint}
      disabled={isPrinting}
      className={className}
      title="Print Order Receipt"
    >
      <Receipt className="h-4 w-4" />
    </Button>
  )
}
