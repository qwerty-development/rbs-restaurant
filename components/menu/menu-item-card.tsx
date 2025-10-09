// components/menu/menu-item-card.tsx
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Edit, Trash2, Leaf, Wheat, Flame, Star } from "lucide-react"
import type { MenuItem } from "@/types"
import { cn } from "@/lib/utils"
import Image from "next/image"

interface MenuItemCardProps {
  item: MenuItem
  onEdit: () => void
  onDelete: () => void
  onToggleAvailability: (isAvailable: boolean) => void
}

const DIETARY_ICONS = {
  vegetarian: { icon: Leaf, color: "text-green-600" },
  vegan: { icon: Leaf, color: "text-green-700" },
  "gluten-free": { icon: Wheat, color: "text-amber-600" },
  spicy: { icon: Flame, color: "text-red-600" },
}

export function MenuItemCard({ item, onEdit, onDelete, onToggleAvailability }: MenuItemCardProps) {
  return (
    <Card className={cn("transition-opacity", !item.is_available && "opacity-60")}>
      <CardContent className="p-4">
        {/* Image */}
        {item.image_url && (
          <div className="aspect-video relative rounded-lg overflow-hidden mb-3">
            <Image
              src={item.image_url}
              alt={item.name}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
            />
            {item.is_featured && (
              <Badge className="absolute top-2 right-2 gap-1">
                <Star className="h-3 w-3" />
                Featured
              </Badge>
            )}
          </div>
        )}

        {/* Content */}
        <div className="space-y-2">
          <div className="flex items-start justify-between">
            <h4 className="font-semibold text-lg">{item.name}</h4>
            <span className="text-lg font-bold">${item.price}</span>
          </div>

          {item.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {item.description}
            </p>
          )}

          {/* Dietary Tags */}
          {item.dietary_tags && item.dietary_tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.dietary_tags.map((tag) => {
                const config = DIETARY_ICONS[tag as keyof typeof DIETARY_ICONS]
                const Icon = config?.icon
                
                return (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {Icon && <Icon className={cn("h-3 w-3 mr-1", config.color)} />}
                    {tag}
                  </Badge>
                )
              })}
            </div>
          )}

          {/* Meta Info */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {item.calories && <span>{item.calories} cal</span>}
            {item.preparation_time && <span>{item.preparation_time} min</span>}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Available</label>
              <Switch
                checked={item.is_available}
                onCheckedChange={onToggleAvailability}
              />
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={onEdit}>
                <Edit className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={onDelete} className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}