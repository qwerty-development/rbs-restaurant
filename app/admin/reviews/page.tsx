'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'react-hot-toast'
import { ChevronLeft, ChevronRight, Search, RefreshCw, FlagTriangleRight, Trash2, ShieldX } from 'lucide-react'

type ReviewRow = {
  id: string
  restaurant_id: string
  user_id: string
  booking_id: string | null
  rating: number
  comment: string | null
  created_at: string
  is_flagged?: boolean | null
  restaurants?: { name: string | null } | null
  profiles?: { full_name: string | null; email: string | null } | null
  review_reports?: { count: number }[] | null
  _flagsCount?: number
}

export default function AdminReviewsPage() {
  const supabase = createClient()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)

  const [search, setSearch] = useState('')
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false)
  const [sortOrder, setSortOrder] = useState<'created_desc' | 'created_asc' | 'flags_desc' | 'flags_asc'>('created_desc')
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<ReviewRow[]>([])

  const [restaurants, setRestaurants] = useState<{ id: string; name: string }[]>([])
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>('all')

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const summary = useMemo(() => {
    const parts: string[] = []
    if (search) parts.push(`Search: ${search}`)
    if (showFlaggedOnly) parts.push('Flagged only')
    if (selectedRestaurant !== 'all') parts.push('Restaurant filtered')
    return parts.join(' • ')
  }, [search, showFlaggedOnly, selectedRestaurant])

  const fetchReviews = async () => {
    try {
      setLoading(true)
      let query = supabase
        .from('reviews')
        .select(
          `id, restaurant_id, user_id, booking_id, rating, comment, created_at,
           restaurants:restaurants!reviews_restaurant_id_fkey(name),
           profiles:profiles!reviews_user_id_fkey(full_name, email),
           review_reports:review_reports(count)`,
          { count: 'exact' }
        )

      if (selectedRestaurant !== 'all') {
        query = query.eq('restaurant_id', selectedRestaurant)
      }
      // Server-side filters that are safe: comment search only
      const s = search.trim()
      if (s) {
        query = query.ilike('comment', `%${s}%`)
      }

      // Always paginate on server by created_at for stability
      query = query.order('created_at', { ascending: sortOrder === 'created_asc' }).range(from, to)

      const { data, error, count } = await query
      if (error) throw error
      const fetched = ((data as unknown as ReviewRow[]) || []).map(r => ({
        ...r,
        _flagsCount: Array.isArray(r.review_reports) && r.review_reports[0]?.count ? r.review_reports[0].count : 0,
      }))
      // Client-side sort for flags when needed
      let sorted = fetched
      if (sortOrder === 'flags_desc') sorted = fetched.slice().sort((a, b) => (b._flagsCount || 0) - (a._flagsCount || 0))
      if (sortOrder === 'flags_asc') sorted = fetched.slice().sort((a, b) => (a._flagsCount || 0) - (b._flagsCount || 0))
      if (sortOrder === 'created_desc') sorted = fetched.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      if (sortOrder === 'created_asc') sorted = fetched.slice().sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      setRows(sorted)
      setTotal(count || 0)
    } catch (e) {
      console.error(e)
      toast.error('Failed to fetch reviews')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReviews()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, sortOrder])

  useEffect(() => {
    const loadRestaurants = async () => {
      const { data } = await supabase.from('restaurants').select('id, name').order('name')
      setRestaurants(data || [])
    }
    loadRestaurants()
  }, [supabase])

  const onApply = () => {
    setPage(1)
    fetchReviews()
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const deleteReview = async (id: string) => {
    try {
      const { error } = await supabase.from('reviews').delete().eq('id', id)
      if (error) throw error
      toast.success('Review deleted')
      fetchReviews()
    } catch (e) {
      console.error(e)
      toast.error('Failed to delete review')
    }
  }

  const clearReports = async (reviewId: string) => {
    try {
      const { error } = await supabase.from('review_reports').delete().eq('review_id', reviewId)
      if (error) throw error
      toast.success('Reports cleared')
      fetchReviews()
    } catch (e) {
      console.error(e)
      toast.error('Failed to clear reports')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">All Reviews</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchReviews} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="w-full">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by reviewer or comment"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div>
              <Select value={selectedRestaurant} onValueChange={(v) => setSelectedRestaurant(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All restaurants" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All restaurants</SelectItem>
                  {restaurants.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={sortOrder} onValueChange={(v: any) => setSortOrder(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_desc">Newest first</SelectItem>
                  <SelectItem value="created_asc">Oldest first</SelectItem>
                  <SelectItem value="flags_desc">Most flags</SelectItem>
                  <SelectItem value="flags_asc">Fewest flags</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={showFlaggedOnly ? 'destructive' : 'outline'}
                onClick={() => setShowFlaggedOnly(v => !v)}
                className="w-full"
              >
                <FlagTriangleRight className="h-4 w-4 mr-2" /> {showFlaggedOnly ? 'Flagged only' : 'All reviews'}
              </Button>
            </div>
            <div>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(parseInt(v))}>
                <SelectTrigger className="w-full lg:w-[110px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 / page</SelectItem>
                  <SelectItem value="20">20 / page</SelectItem>
                  <SelectItem value="50">50 / page</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex sm:justify-end">
              <Button onClick={onApply} disabled={loading} className="w-full sm:w-auto">Apply</Button>
            </div>
          </div>
          {summary && (
            <div className="text-xs text-muted-foreground">{summary}</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Results ({total})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : rows.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No reviews found</div>
          ) : (
            <div className="space-y-3">
              {(showFlaggedOnly
                ? rows.filter(r => (r._flagsCount || 0) > 0 || (r.is_flagged ?? false))
                : rows
              ).filter(r => {
                const s = search.trim().toLowerCase()
                if (!s) return true
                const name = r.profiles?.full_name?.toLowerCase() || ''
                const email = r.profiles?.email?.toLowerCase() || ''
                const comment = r.comment?.toLowerCase() || ''
                return name.includes(s) || email.includes(s) || comment.includes(s)
              }).map((row) => (
                <ReviewRowItem key={row.id} row={row} onDelete={deleteReview} onClearReports={clearReports} />
              ))}
            </div>
          )}

          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-muted-foreground">Page {page} of {Math.max(1, Math.ceil(total / pageSize))}</div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Prev
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / pageSize)}>
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ReviewRowItem({ row, onDelete, onClearReports }: { row: ReviewRow; onDelete: (id: string) => void; onClearReports: (id: string) => void }) {
  const restaurantName = row.restaurants?.name || 'Unknown Restaurant'
  const reviewer = row.profiles?.full_name || 'Anonymous'
  const email = row.profiles?.email || ''
  const date = new Date(row.created_at).toLocaleString()

  return (
    <div className={`border rounded-lg p-3 ${(row._flagsCount || 0) > 0 ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium truncate max-w-[260px]">{reviewer}</span>
            {email && <span className="text-xs text-muted-foreground truncate max-w-[240px]">{email}</span>}
            <span className="text-xs bg-slate-100 text-slate-700 border border-slate-200 rounded px-2 py-0.5 truncate max-w-[240px]">{restaurantName}</span>
            <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded px-2 py-0.5">{row.rating} ★</span>
            {(row._flagsCount || 0) > 0 && (
              <span className="text-xs bg-red-100 text-red-700 border border-red-200 rounded px-2 py-0.5 inline-flex items-center">
                <FlagTriangleRight className="h-3 w-3 mr-1" /> {row._flagsCount} flag{(row._flagsCount || 0) === 1 ? '' : 's'}
              </span>
            )}
          </div>
          {row.comment && (
            <div className="text-sm text-slate-700 whitespace-pre-wrap break-words">
              {row.comment}
            </div>
          )}
          <div className="text-xs text-muted-foreground">{date}</div>
        </div>
        <div className="flex items-center gap-2">
          {(row._flagsCount || 0) > 0 && (
            <Button size="sm" variant="outline" onClick={() => onClearReports(row.id)}>
              <ShieldX className="h-4 w-4 mr-1" /> Clear flags
            </Button>
          )}
          {(row._flagsCount || 0) > 0 && (
            <Button size="sm" variant="destructive" onClick={() => onDelete(row.id)}>
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}


