// components/dashboard/top-customers.tsx
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface TopCustomer {
  user_id: string
  user: {
    full_name: string
    avatar_url?: string
  }
  count: number
}

interface TopCustomersProps {
  customers: TopCustomer[]
}

export function TopCustomers({ customers }: TopCustomersProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Customers</CardTitle>
        <CardDescription>Most frequent diners</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {customers.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No customer data yet
            </p>
          ) : (
            customers.map((customer, index) => (
              <div key={customer.user_id} className="flex items-center space-x-4">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-medium">
                  #{index + 1}
                </div>
                <Avatar className="h-10 w-10">
                  <AvatarImage src={customer.user.avatar_url} />
                  <AvatarFallback>
                    {customer.user.full_name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-sm font-medium leading-none">
                    {customer.user.full_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {customer.count} bookings
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}