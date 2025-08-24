// components/dashboard/stats-cards.tsx
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowUpIcon, ArrowDownIcon, ArrowRightIcon, TrendingUp, TrendingDown } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface StatCard {
  title: string
  value: string
  description: string
  trend?: {
    value: number
    isPositive: boolean
  } | null
  link?: string
}

interface StatsCardsProps {
  stats: StatCard[]
}

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <Card
          key={index}
          className={cn(
            "group cursor-pointer animate-slide-up",
            "hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20",
            "transition-all duration-300 ease-out"
          )}
          style={{
            animationDelay: `${index * 100}ms`
          }}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-semibold text-foreground/80 group-hover:text-foreground transition-colors">
              {stat.title}
            </CardTitle>
            {stat.trend && (
              <div className={cn(
                "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
                stat.trend.isPositive
                  ? "text-green-700 bg-green-50 border border-green-200"
                  : "text-red-700 bg-red-50 border border-red-200"
              )}>
                {stat.trend.isPositive ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                <span>{stat.trend.value}%</span>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {stat.link ? (
              <Link href={stat.link} className="group/link">
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/90 bg-clip-text text-transparent group-hover/link:scale-105 transition-transform duration-200">
                    {stat.value}
                  </span>
                  <ArrowRightIcon className="h-5 w-5 text-primary/60 group-hover/link:text-primary group-hover/link:translate-x-1 transition-all duration-200" />
                </div>
              </Link>
            ) : (
              <div className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                {stat.value}
              </div>
            )}
            <p className="text-sm text-muted-foreground font-medium">
              {stat.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}