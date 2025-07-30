// app/(dashboard)/reviews/page.tsx
"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ReviewReply } from "@/components/reviews/review-reply"
import { toast } from "react-hot-toast"
import { 
  Star, 
  Search, 
  TrendingUp, 
  MessageSquare,
  ThumbsUp,
  Filter,
  Calendar
} from "lucide-react"
import { format } from "date-fns"

// Type definitions
type Review = {
  id: string
  booking_id: string
  user_id: string
  restaurant_id: string
  rating: number
  comment?: string
  created_at: string
  updated_at: string
  food_rating?: number
  service_rating?: number
  ambiance_rating?: number
  value_rating?: number
  recommend_to_friend?: boolean
  visit_again?: boolean
  tags?: string[]
  photos?: string[]
  user?: {
    id: string
    full_name: string
    avatar_url?: string
  }
  booking?: {
    id: string
    booking_time: string
    party_size: number
  }
  reply?: {
    id: string
    reply_message: string
    created_at: string
    staff_member?: {
      full_name: string
      avatar_url?: string
    }
  }
}

type ReviewStats = {
  total_reviews: number
  average_rating: number
  rating_distribution: Record<string, number>
  detailed_ratings: {
    food_avg: number
    service_avg: number
    ambiance_avg: number
    value_avg: number
  }
  recommendation_percentage: number
}

export default function ReviewsPage() {
  const supabase = createClient()
  const [searchQuery, setSearchQuery] = useState("")
  const [ratingFilter, setRatingFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("newest")
  const [restaurantId, setRestaurantId] = useState<string>("")

  // Get restaurant ID
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
  const { data: reviews, isLoading: reviewsLoading } = useQuery({
    queryKey: ["restaurant-reviews", restaurantId, sortBy],
    queryFn: async () => {
      if (!restaurantId) return []
      
      let query = supabase
        .from("reviews")
        .select(`
          *,
          user:profiles(id, full_name, avatar_url),
          booking:bookings(id, booking_time, party_size),
          reply:review_replies(
            id,
            reply_message,
            created_at,
            staff_member:profiles!review_replies_replied_by_fkey(full_name, avatar_url)
          )
        `)
        .eq("restaurant_id", restaurantId)

      // Apply sorting
      if (sortBy === "newest") {
        query = query.order("created_at", { ascending: false })
      } else if (sortBy === "oldest") {
        query = query.order("created_at", { ascending: true })
      } else if (sortBy === "highest") {
        query = query.order("rating", { ascending: false })
      } else if (sortBy === "lowest") {
        query = query.order("rating", { ascending: true })
      }

      const { data, error } = await query

      if (error) throw error
      return data as Review[]
    },
    enabled: !!restaurantId,
  })

  // Calculate review statistics
  const reviewStats: ReviewStats | null = reviews ? {
    total_reviews: reviews.length,
    average_rating: reviews.length > 0 
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length 
      : 0,
    rating_distribution: reviews.reduce((dist, review) => {
      dist[review.rating] = (dist[review.rating] || 0) + 1
      return dist
    }, {} as Record<string, number>),
    detailed_ratings: {
      food_avg: reviews.filter(r => r.food_rating).length > 0
        ? reviews.reduce((sum, r) => sum + (r.food_rating || 0), 0) / reviews.filter(r => r.food_rating).length
        : 0,
      service_avg: reviews.filter(r => r.service_rating).length > 0
        ? reviews.reduce((sum, r) => sum + (r.service_rating || 0), 0) / reviews.filter(r => r.service_rating).length
        : 0,
      ambiance_avg: reviews.filter(r => r.ambiance_rating).length > 0
        ? reviews.reduce((sum, r) => sum + (r.ambiance_rating || 0), 0) / reviews.filter(r => r.ambiance_rating).length
        : 0,
      value_avg: reviews.filter(r => r.value_rating).length > 0
        ? reviews.reduce((sum, r) => sum + (r.value_rating || 0), 0) / reviews.filter(r => r.value_rating).length
        : 0,
    },
    recommendation_percentage: reviews.filter(r => r.recommend_to_friend).length > 0
      ? (reviews.filter(r => r.recommend_to_friend).length / reviews.length) * 100
      : 0,
  } : null

  // Filter reviews
  const filteredReviews = reviews?.filter((review) => {
    const matchesSearch = !searchQuery || 
      review.comment?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      review.user?.full_name.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesRating = ratingFilter === "all" || 
      review.rating.toString() === ratingFilter
    
    return matchesSearch && matchesRating
  })

  // Render star rating
  const renderStars = (rating: number, size: number = 16) => {
    return (
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={size}
            className={star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}
          />
        ))}
      </div>
    )
  }

  if (reviewsLoading) {
    return <div className="flex items-center justify-center h-screen">Loading reviews...</div>
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reviews</h1>
        <p className="text-muted-foreground">
          View and manage customer reviews for your restaurant
        </p>
      </div>

      {/* Statistics */}
      {reviewStats && (
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Reviews</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reviewStats.total_reviews}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {reviewStats.average_rating.toFixed(1)}
              </div>
              {renderStars(Math.round(reviewStats.average_rating))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Food Rating</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {reviewStats.detailed_ratings.food_avg.toFixed(1)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Service Rating</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {reviewStats.detailed_ratings.service_avg.toFixed(1)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recommend %</CardTitle>
              <ThumbsUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {reviewStats.recommendation_percentage.toFixed(0)}%
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Rating Distribution */}
      {reviewStats && (
        <Card>
          <CardHeader>
            <CardTitle>Rating Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[5, 4, 3, 2, 1].map((rating) => {
                const count = reviewStats.rating_distribution[rating] || 0
                const percentage = reviewStats.total_reviews > 0
                  ? (count / reviewStats.total_reviews) * 100
                  : 0

                return (
                  <div key={rating} className="flex items-center gap-4">
                    <div className="flex items-center gap-1 w-20">
                      <span className="text-sm font-medium">{rating}</span>
                      <Star size={14} className="fill-yellow-400 text-yellow-400" />
                    </div>
                    <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-yellow-400 h-full transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground w-16 text-right">
                      {count} ({percentage.toFixed(0)}%)
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reviews List */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Reviews</CardTitle>
          <CardDescription>
            All reviews from your customers
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search reviews..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={ratingFilter} onValueChange={setRatingFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All ratings" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ratings</SelectItem>
                <SelectItem value="5">5 stars</SelectItem>
                <SelectItem value="4">4 stars</SelectItem>
                <SelectItem value="3">3 stars</SelectItem>
                <SelectItem value="2">2 stars</SelectItem>
                <SelectItem value="1">1 star</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="highest">Highest rated</SelectItem>
                <SelectItem value="lowest">Lowest rated</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reviews */}
          {filteredReviews?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery || ratingFilter !== "all" 
                ? "No reviews found matching your filters" 
                : "No reviews yet"}
            </div>
          ) : (
            <div className="space-y-6">
              {filteredReviews?.map((review) => (
                <div key={review.id} className="border rounded-lg p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={review.user?.avatar_url} />
                        <AvatarFallback>
                          {review.user?.full_name.split(" ").map(n => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h4 className="font-semibold">{review.user?.full_name}</h4>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(review.created_at), "PPP")}
                          {review.booking && (
                            <>
                              <span>•</span>
                              <span>Party of {review.booking.party_size}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    {renderStars(review.rating, 20)}
                  </div>

                  {review.comment && (
                    <p className="text-gray-700 dark:text-gray-300 mb-4">
                      {review.comment}
                    </p>
                  )}

                  {/* Detailed ratings */}
                  {(review.food_rating || review.service_rating || review.ambiance_rating || review.value_rating) && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                      {review.food_rating && (
                        <div>
                          <p className="text-sm text-muted-foreground">Food</p>
                          {renderStars(review.food_rating)}
                        </div>
                      )}
                      {review.service_rating && (
                        <div>
                          <p className="text-sm text-muted-foreground">Service</p>
                          {renderStars(review.service_rating)}
                        </div>
                      )}
                      {review.ambiance_rating && (
                        <div>
                          <p className="text-sm text-muted-foreground">Ambiance</p>
                          {renderStars(review.ambiance_rating)}
                        </div>
                      )}
                      {review.value_rating && (
                        <div>
                          <p className="text-sm text-muted-foreground">Value</p>
                          {renderStars(review.value_rating)}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tags and recommendations */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {review.recommend_to_friend && (
                      <Badge variant="outline" className="text-green-600">
                        <ThumbsUp className="h-3 w-3 mr-1" />
                        Would recommend
                      </Badge>
                    )}
                    {review.visit_again && (
                      <Badge variant="outline" className="text-blue-600">
                        Will visit again
                      </Badge>
                    )}
                    {review.tags?.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  {/* Review Reply */}
                  <ReviewReply
                    reviewId={review.id}
                    restaurantId={restaurantId}
                    existingReply={review.reply ? {
                      id: review.reply.id,
                      reply_message: review.reply.reply_message,
                      created_at: review.reply.created_at,
                      staff_member: review.reply.staff_member
                    } : undefined}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}