// app/(dashboard)/help/page.tsx
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Mail, BookOpen, LifeBuoy } from "lucide-react"
import Link from "next/link"

export default function HelpPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Help & Support</h1>
        <p className="text-muted-foreground">Find guides and contact support</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Documentation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Read setup guides and best practices to get the most out of the app.
            </p>
            <Link href="/README" prefetch={false}>
              <Button variant="outline" className="w-full">View Docs</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LifeBuoy className="h-5 w-5" />
              Troubleshooting
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Common issues and solutions for bookings, schedules, and PWA.
            </p>
            <Link href="/docs/booking-system" prefetch={false}>
              <Button variant="outline" className="w-full">Open Guide</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Contact Support
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Need help? Reach out and we’ll get back to you shortly.
            </p>
            <a href="mailto:your-restaurant@example.com">
              <Button className="w-full">Email Support</Button>
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


