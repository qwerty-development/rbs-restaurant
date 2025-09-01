// lib/services/print-service.ts
"use client"

import { createClient } from "@/lib/supabase/client"

export interface PrintOptions {
  copies?: number
  paperSize?: 'receipt' | 'a4' | 'letter'
  orientation?: 'portrait' | 'landscape'
  margins?: {
    top: number
    right: number
    bottom: number
    left: number
  }
}

export interface PrintJob {
  id: string
  type: 'kitchen_ticket' | 'service_ticket' | 'receipt' | 'report'
  content: string
  options: PrintOptions
  timestamp: Date
  status: 'pending' | 'printing' | 'completed' | 'failed'
}

export class PrintService {
  private printQueue: PrintJob[] = []
  private isProcessing = false
  private supabase = createClient()

  // Print order ticket
  async printOrderTicket(
    orderId: string, 
    ticketType: 'kitchen' | 'service' | 'receipt' = 'kitchen',
    options: PrintOptions = {}
  ): Promise<boolean> {
    try {
      // Get order data using direct Supabase call
      const { data: order, error } = await this.supabase
        .from('orders')
        .select(`
          *,
          booking:bookings!orders_booking_id_fkey(
            id,
            guest_name,
            party_size,
            profiles!bookings_user_id_fkey(
              id,
              full_name,
              phone_number
            )
          ),
          table:restaurant_tables!orders_table_id_fkey(
            id,
            table_number,
            table_type
          ),
          order_items(
            *,
            menu_item:menu_items!order_items_menu_item_id_fkey(
              id,
              name,
              description,
              price,
              dietary_tags,
              allergens
            ),
            order_modifications(
              *,
              modification:menu_modifications!order_modifications_modification_id_fkey(
                id,
                name,
                price_adjustment
              )
            )
          )
        `)
        .eq('id', orderId)
        .single()

      if (error || !order) {
        throw new Error('Failed to fetch order data')
      }
      
      // Generate ticket content
      const ticketContent = this.generateTicketHTML(order, ticketType)
      
      // Create print job
      const printJob: PrintJob = {
        id: `${orderId}-${ticketType}-${Date.now()}`,
        type: `${ticketType}_ticket` as PrintJob['type'],
        content: ticketContent,
        options: {
          copies: 1,
          paperSize: 'receipt',
          orientation: 'portrait',
          margins: { top: 5, right: 5, bottom: 5, left: 5 },
          ...options
        },
        timestamp: new Date(),
        status: 'pending'
      }

      // Add to queue and process
      this.printQueue.push(printJob)
      await this.processPrintQueue()
      
      return true

    } catch (error) {
      console.error('Print order ticket error:', error)
      return false
    }
  }

  // Generate HTML content for ticket
  private generateTicketHTML(order: any, ticketType: string): string {
    const isHighPriority = order.priority_level >= 4
    const hasAllergens = order.order_items.some((item: any) => item.menu_item.allergens.length > 0)
    const hasDietaryRequirements = order.dietary_requirements.length > 0 || 
      order.order_items.some((item: any) => item.dietary_modifications.length > 0)

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Order ${order.order_number} - ${ticketType.toUpperCase()}</title>
        <style>
          @media print {
            @page {
              size: 80mm auto;
              margin: 2mm;
            }
            body {
              margin: 0;
              padding: 0;
            }
          }
          
          body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.2;
            width: 80mm;
            margin: 0 auto;
            padding: 5mm;
            background: white;
            color: black;
          }
          
          .header {
            text-align: center;
            border-bottom: 2px solid black;
            padding-bottom: 5px;
            margin-bottom: 10px;
          }
          
          .title {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 2px;
          }
          
          .order-info {
            margin-bottom: 10px;
          }
          
          .order-number {
            font-size: 18px;
            font-weight: bold;
            text-align: center;
            margin: 5px 0;
          }
          
          .priority-high {
            background: #fef2f2;
            border: 2px solid #dc2626;
            color: #dc2626;
            padding: 3px;
            text-align: center;
            font-weight: bold;
            margin: 5px 0;
          }

          .allergen-alert {
            background: #fed7aa;
            color: #ea580c;
            border: 1px solid #ea580c;
            padding: 3px;
            text-align: center;
            font-weight: bold;
            margin: 5px 0;
          }

          .dietary-alert {
            background: #dbeafe;
            color: #2563eb;
            border: 1px solid #2563eb;
            padding: 3px;
            text-align: center;
            font-weight: bold;
            margin: 5px 0;
          }
          
          .items {
            border-top: 1px solid black;
            border-bottom: 1px solid black;
            padding: 5px 0;
            margin: 10px 0;
          }
          
          .item {
            margin-bottom: 8px;
            padding-bottom: 5px;
            border-bottom: 1px dashed #ccc;
          }
          
          .item:last-child {
            border-bottom: none;
          }
          
          .item-name {
            font-weight: bold;
            font-size: 13px;
          }
          
          .item-details {
            font-size: 10px;
            margin-top: 2px;
          }
          
          .allergens {
            color: #dc2626;
            font-weight: bold;
            font-size: 10px;
          }
          
          .instructions {
            background: #fefce8;
            border: 1px solid #eab308;
            color: #a16207;
            padding: 3px;
            margin: 3px 0;
            font-size: 10px;
          }

          .modifications {
            background: #eff6ff;
            border: 1px solid #3b82f6;
            color: #1d4ed8;
            padding: 3px;
            margin: 3px 0;
            font-size: 10px;
          }
          
          .footer {
            text-align: center;
            border-top: 2px solid black;
            padding-top: 5px;
            margin-top: 10px;
            font-size: 10px;
          }
          
          .separator {
            text-align: center;
            margin: 5px 0;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">
            ${ticketType === 'kitchen' ? 'KITCHEN ORDER' : 
              ticketType === 'service' ? 'SERVICE TICKET' : 'ORDER RECEIPT'}
          </div>
          <div>${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</div>
        </div>

        <div class="order-info">
          <div class="order-number">#${order.order_number}</div>
          <div>Time: ${new Date(order.created_at).toLocaleTimeString()}</div>
          <div>Table: ${order.table?.table_number || 'N/A'}</div>
          <div>Guest: ${order.booking?.guest_name} (${order.booking?.party_size} guests)</div>
          <div>Type: ${order.order_type.replace('_', ' ').toUpperCase()}</div>
          ${order.course_type ? `<div>Course: ${order.course_type.replace('_', ' ').toUpperCase()}</div>` : ''}
        </div>

        ${isHighPriority ? '<div class="priority-high">⭐ HIGH PRIORITY ORDER ⭐</div>' : ''}
        ${hasAllergens ? '<div class="allergen-alert">⚠️ ALLERGEN ALERT ⚠️</div>' : ''}
        ${hasDietaryRequirements ? '<div class="dietary-alert">🍽️ DIETARY REQUIREMENTS</div>' : ''}

        <div class="items">
          <div style="font-weight: bold; margin-bottom: 5px;">ITEMS:</div>
          ${order.order_items.map((item: any) => `
            <div class="item">
              <div class="item-name">${item.quantity}x ${item.menu_item.name}</div>
              
              ${item.menu_item.preparation_time && ticketType === 'kitchen' ? 
                `<div class="item-details">⏱️ ${item.menu_item.preparation_time}min</div>` : ''}
              
              ${item.menu_item.dietary_tags.length > 0 ? 
                `<div class="item-details">🏷️ ${item.menu_item.dietary_tags.join(', ')}</div>` : ''}
              
              ${item.menu_item.allergens.length > 0 ? 
                `<div class="allergens">⚠️ ALLERGENS: ${item.menu_item.allergens.join(', ').toUpperCase()}</div>` : ''}
              
              ${item.special_instructions ? 
                `<div class="instructions"><strong>NOTE:</strong> ${item.special_instructions}</div>` : ''}
              
              ${item.dietary_modifications.length > 0 ? 
                `<div class="modifications"><strong>MODIFY:</strong> ${item.dietary_modifications.join(', ')}</div>` : ''}
              
              ${item.order_modifications.length > 0 ? 
                item.order_modifications.map((mod: any) => 
                  `<div class="modifications"><strong>${mod.modification_type.toUpperCase()}:</strong> ${mod.description}</div>`
                ).join('') : ''}
            </div>
          `).join('')}
        </div>

        ${order.special_instructions ? `
          <div class="instructions">
            <strong>ORDER INSTRUCTIONS:</strong><br>
            ${order.special_instructions}
          </div>
        ` : ''}

        ${order.dietary_requirements.length > 0 ? `
          <div class="modifications">
            <strong>DIETARY REQUIREMENTS:</strong><br>
            ${order.dietary_requirements.join(', ')}
          </div>
        ` : ''}

        <div class="footer">
          <div>Status: ${order.status.toUpperCase()}</div>
          <div>${ticketType === 'kitchen' ? '👨‍🍳 Kitchen Copy' : 
                  ticketType === 'service' ? '🍽️ Service Copy' : '🧾 Receipt'}</div>
        </div>
      </body>
      </html>
    `
  }

  // Generate customer receipt template
  private generateCustomerReceiptTemplate(receiptData: any): string {
    const { booking_id, guest_name, party_size, table_number, date, time, orders } = receiptData

    let itemsHtml = ''
    let subtotal = 0
    let totalTax = 0
    let grandTotal = 0

    orders.forEach((order: any) => {
      order.order_items?.forEach((item: any) => {
        const itemTotal = item.quantity * item.menu_item.price
        subtotal += itemTotal
        itemsHtml += `
          <tr>
            <td>${item.menu_item.name}</td>
            <td style="text-align: center;">${item.quantity}</td>
            <td style="text-align: right;">$${item.menu_item.price.toFixed(2)}</td>
            <td style="text-align: right;">$${itemTotal.toFixed(2)}</td>
          </tr>
        `
      })
      totalTax += order.tax_amount || 0
      grandTotal += order.total_amount || 0
    })

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Customer Receipt</title>
        <style>
          body { font-family: 'Courier New', monospace; font-size: 12px; margin: 0; padding: 10px; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
          .restaurant-name { font-size: 18px; font-weight: bold; }
          .receipt-info { margin-bottom: 15px; }
          .items-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
          .items-table th, .items-table td { padding: 5px; border-bottom: 1px solid #ccc; }
          .items-table th { background-color: #f5f5f5; font-weight: bold; }
          .totals { border-top: 2px solid #000; padding-top: 10px; }
          .total-line { display: flex; justify-content: space-between; margin: 3px 0; }
          .grand-total { font-weight: bold; font-size: 14px; border-top: 1px solid #000; padding-top: 5px; }
          .footer { text-align: center; margin-top: 20px; border-top: 1px solid #ccc; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="restaurant-name">Restaurant Receipt</div>
          <div>Thank you for dining with us!</div>
        </div>

        <div class="receipt-info">
          <div><strong>Guest:</strong> ${guest_name}</div>
          <div><strong>Party Size:</strong> ${party_size}</div>
          <div><strong>Table:</strong> ${table_number}</div>
          <div><strong>Date:</strong> ${date}</div>
          <div><strong>Time:</strong> ${time}</div>
          <div><strong>Receipt #:</strong> ${booking_id.slice(-8)}</div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="totals">
          <div class="total-line">
            <span>Subtotal:</span>
            <span>$${subtotal.toFixed(2)}</span>
          </div>
          <div class="total-line">
            <span>Tax:</span>
            <span>$${totalTax.toFixed(2)}</span>
          </div>
          <div class="total-line grand-total">
            <span>Total:</span>
            <span>$${grandTotal.toFixed(2)}</span>
          </div>
        </div>

        <div class="footer">
          <div>Thank you for your visit!</div>
          <div>Please come again soon</div>
        </div>
      </body>
      </html>
    `
  }

  // Generate kitchen summary template
  private generateKitchenSummaryTemplate(summaryData: any): string {
    const { booking_id, guest_name, table_number, orders, completion_time } = summaryData

    let ordersHtml = ''
    orders.forEach((order: any) => {
      ordersHtml += `
        <div class="order-section">
          <h3>Order #${order.order_number}</h3>
          <div><strong>Status:</strong> ${order.status}</div>
          <div><strong>Course:</strong> ${order.course_type || 'All courses'}</div>
          <div class="items">
            ${order.order_items?.map((item: any) => `
              <div class="item">
                ${item.quantity}x ${item.menu_item.name}
                ${item.special_instructions ? `<br><em>Note: ${item.special_instructions}</em>` : ''}
              </div>
            `).join('') || ''}
          </div>
        </div>
      `
    })

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Kitchen Summary</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 12px; margin: 0; padding: 10px; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
          .summary-info { margin-bottom: 15px; background-color: #f5f5f5; padding: 10px; }
          .order-section { margin-bottom: 15px; border: 1px solid #ccc; padding: 10px; }
          .items { margin-top: 10px; }
          .item { margin: 5px 0; padding: 5px; background-color: #f9f9f9; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>Kitchen Summary Report</h2>
          <div>Service Completion Summary</div>
        </div>

        <div class="summary-info">
          <div><strong>Guest:</strong> ${guest_name}</div>
          <div><strong>Table:</strong> ${table_number}</div>
          <div><strong>Booking ID:</strong> ${booking_id}</div>
          <div><strong>Completed:</strong> ${completion_time}</div>
        </div>

        ${ordersHtml}

        <div style="text-align: center; margin-top: 20px; border-top: 1px solid #ccc; padding-top: 10px;">
          <strong>Service Complete - Table Ready for Turnover</strong>
        </div>
      </body>
      </html>
    `
  }

  // Generate order receipt template
  private generateOrderReceiptTemplate(receiptData: any): string {
    const { order_id, order_number, guest_name, table_number, order_items, subtotal, tax_amount, total_amount, special_instructions } = receiptData

    let itemsHtml = ''
    order_items.forEach((item: any) => {
      itemsHtml += `
        <tr>
          <td>${item.menu_item.name}</td>
          <td style="text-align: center;">${item.quantity}</td>
          <td style="text-align: right;">$${item.unit_price.toFixed(2)}</td>
          <td style="text-align: right;">$${item.total_price.toFixed(2)}</td>
        </tr>
      `
    })

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Order Receipt</title>
        <style>
          body { font-family: 'Courier New', monospace; font-size: 12px; margin: 0; padding: 10px; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
          .order-info { margin-bottom: 15px; }
          .items-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
          .items-table th, .items-table td { padding: 5px; border-bottom: 1px solid #ccc; }
          .items-table th { background-color: #f5f5f5; font-weight: bold; }
          .totals { border-top: 2px solid #000; padding-top: 10px; }
          .total-line { display: flex; justify-content: space-between; margin: 3px 0; }
          .special-instructions { margin-top: 15px; padding: 10px; background-color: #fff3cd; border: 1px solid #ffeaa7; }
        </style>
      </head>
      <body>
        <div class="header">
          <div style="font-size: 16px; font-weight: bold;">Order Receipt</div>
          <div>Order #${order_number}</div>
        </div>

        <div class="order-info">
          <div><strong>Guest:</strong> ${guest_name}</div>
          <div><strong>Table:</strong> ${table_number}</div>
          <div><strong>Order ID:</strong> ${order_id.slice(-8)}</div>
          <div><strong>Time:</strong> ${new Date().toLocaleTimeString()}</div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="totals">
          <div class="total-line">
            <span>Subtotal:</span>
            <span>$${subtotal.toFixed(2)}</span>
          </div>
          <div class="total-line">
            <span>Tax:</span>
            <span>$${tax_amount.toFixed(2)}</span>
          </div>
          <div class="total-line" style="font-weight: bold; font-size: 14px; border-top: 1px solid #000; padding-top: 5px;">
            <span>Total:</span>
            <span>$${total_amount.toFixed(2)}</span>
          </div>
        </div>

        ${special_instructions ? `
          <div class="special-instructions">
            <strong>Special Instructions:</strong><br>
            ${special_instructions}
          </div>
        ` : ''}
      </body>
      </html>
    `
  }

  // Process print queue
  private async processPrintQueue(): Promise<void> {
    if (this.isProcessing || this.printQueue.length === 0) {
      return
    }

    this.isProcessing = true

    while (this.printQueue.length > 0) {
      const job = this.printQueue.shift()
      if (!job) continue

      try {
        job.status = 'printing'
        await this.executePrintJob(job)
        job.status = 'completed'
      } catch (error) {
        console.error('Print job failed:', error)
        job.status = 'failed'
      }
    }

    this.isProcessing = false
  }

  // Execute individual print job
  private async executePrintJob(job: PrintJob): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Create a new window for printing
        const printWindow = window.open('', '_blank', 'width=400,height=600')
        
        if (!printWindow) {
          throw new Error('Failed to open print window')
        }

        // Write content to print window
        printWindow.document.write(job.content)
        printWindow.document.close()

        // Wait for content to load, then print
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print()
            
            // Close window after printing
            setTimeout(() => {
              printWindow.close()
              resolve()
            }, 1000)
          }, 500)
        }

        // Handle print window errors
        printWindow.onerror = (error) => {
          printWindow.close()
          reject(error)
        }

      } catch (error) {
        reject(error)
      }
    })
  }

  // Print multiple tickets for an order
  async printOrderTickets(
    orderId: string, 
    ticketTypes: Array<'kitchen' | 'service'> = ['kitchen'],
    options: PrintOptions = {}
  ): Promise<boolean> {
    try {
      const results = await Promise.all(
        ticketTypes.map(type => this.printOrderTicket(orderId, type, options))
      )
      
      return results.every(result => result === true)

    } catch (error) {
      console.error('Print multiple tickets error:', error)
      return false
    }
  }

  // Get print queue status
  getPrintQueueStatus(): {
    pending: number
    processing: boolean
    lastJob?: PrintJob
  } {
    return {
      pending: this.printQueue.length,
      processing: this.isProcessing,
      lastJob: this.printQueue[this.printQueue.length - 1]
    }
  }

  // Clear print queue
  clearPrintQueue(): void {
    this.printQueue = []
  }

  // Print customer receipt for completed booking
  async printReceipt(receiptData: any): Promise<void> {
    try {
      const template = this.generateCustomerReceiptTemplate(receiptData)
      const printJob: PrintJob = {
        id: `receipt-${receiptData.booking_id}-${Date.now()}`,
        type: 'receipt',
        content: template,
        options: { paperSize: 'receipt' },
        timestamp: new Date(),
        status: 'pending'
      }

      this.printQueue.push(printJob)
      await this.processPrintQueue()

      console.log('Customer receipt queued for printing')
    } catch (error) {
      console.error('Error printing customer receipt:', error)
      throw error
    }
  }

  // Print kitchen summary for completed service
  async printKitchenSummary(summaryData: any): Promise<void> {
    try {
      const template = this.generateKitchenSummaryTemplate(summaryData)
      const printJob: PrintJob = {
        id: `kitchen-summary-${summaryData.booking_id}-${Date.now()}`,
        type: 'report',
        content: template,
        options: { paperSize: 'receipt' },
        timestamp: new Date(),
        status: 'pending'
      }

      this.printQueue.push(printJob)
      await this.processPrintQueue()

      console.log('Kitchen summary queued for printing')
    } catch (error) {
      console.error('Error printing kitchen summary:', error)
      throw error
    }
  }

  // Print individual order receipt
  async printOrderReceipt(receiptData: any): Promise<void> {
    try {
      const template = this.generateOrderReceiptTemplate(receiptData)
      const printJob: PrintJob = {
        id: `order-receipt-${receiptData.order_id}-${Date.now()}`,
        type: 'receipt',
        content: template,
        options: { paperSize: 'receipt' },
        timestamp: new Date(),
        status: 'pending'
      }

      this.printQueue.push(printJob)
      await this.processPrintQueue()

      console.log('Order receipt queued for printing')
    } catch (error) {
      console.error('Error printing order receipt:', error)
      throw error
    }
  }

  // Auto-print based on order status
  async autoPrintOnStatusChange(
    orderId: string, 
    newStatus: string, 
    orderType: string = 'dine_in'
  ): Promise<void> {
    try {
      const printRules = this.getAutoPrintRules(orderType)
      const ticketsToPrint = printRules[newStatus] || []

      if (ticketsToPrint.length > 0) {
        await this.printOrderTickets(orderId, ticketsToPrint)
        console.log(`Auto-printed ${ticketsToPrint.join(', ')} tickets for order ${orderId}`)
      }

    } catch (error) {
      console.error('Auto-print error:', error)
    }
  }

  // Get auto-print rules based on order type
  private getAutoPrintRules(orderType: string): Record<string, Array<'kitchen' | 'service'>> {
    const rules:any = {
      dine_in: {
        confirmed: ['kitchen'],
        ready: ['service']
      },
      takeaway: {
        confirmed: ['kitchen'],
        ready: ['kitchen'] // Print receipt for takeaway
      },
      delivery: {
        confirmed: ['kitchen'],
        ready: ['kitchen']
      }
    }

    return rules[orderType as keyof typeof rules] || rules.dine_in
  }
}

// Singleton instance
let printServiceInstance: PrintService | null = null

export function getPrintService(): PrintService {
  if (!printServiceInstance) {
    printServiceInstance = new PrintService()
  }
  return printServiceInstance
}

// React hook for using print service
import { useState, useCallback } from 'react'

export function usePrintService() {
  const [printService] = useState(() => getPrintService())
  const [isPrinting, setIsPrinting] = useState(false)

  const printOrderTicket = useCallback(async (
    orderId: string, 
    ticketType: 'kitchen' | 'service' | 'receipt' = 'kitchen',
    options: PrintOptions = {}
  ) => {
    setIsPrinting(true)
    try {
      const result = await printService.printOrderTicket(orderId, ticketType, options)
      return result
    } finally {
      setIsPrinting(false)
    }
  }, [printService])

  const printOrderTickets = useCallback(async (
    orderId: string, 
    ticketTypes: Array<'kitchen' | 'service'> = ['kitchen'],
    options: PrintOptions = {}
  ) => {
    setIsPrinting(true)
    try {
      const result = await printService.printOrderTickets(orderId, ticketTypes, options)
      return result
    } finally {
      setIsPrinting(false)
    }
  }, [printService])

  const autoPrint = useCallback(async (
    orderId: string, 
    newStatus: string, 
    orderType: string = 'dine_in'
  ) => {
    await printService.autoPrintOnStatusChange(orderId, newStatus, orderType)
  }, [printService])

  return {
    printOrderTicket,
    printOrderTickets,
    autoPrint,
    isPrinting,
    queueStatus: printService.getPrintQueueStatus()
  }
}
