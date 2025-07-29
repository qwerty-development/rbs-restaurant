// components/menu/menu-categories.tsx
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { MenuCategory } from "@/types"

interface MenuCategoriesProps {
  categories: MenuCategory[]
  selectedCategory: string
  onSelectCategory: (categoryId: string) => void
  isLoading: boolean
  itemCounts: Record<string, number>
}

export function MenuCategories({
  categories,
  selectedCategory,
  onSelectCategory,
  isLoading,
  itemCounts,
}: MenuCategoriesProps) {
  if (isLoading) {
    return <div className="text-center py-4">Loading categories...</div>
  }

  return (
    <ScrollArea className="h-[600px]">
      <div className="space-y-2 p-4 bg-muted/30 rounded-lg">
        <Button
          variant={selectedCategory === "all" ? "secondary" : "ghost"}
          className="w-full justify-between"
          onClick={() => onSelectCategory("all")}
        >
          <span>All Items</span>
          <Badge variant="secondary">
            {Object.values(itemCounts).reduce((sum, count) => sum + count, 0)}
          </Badge>
        </Button>
        
        {categories.map((category) => (
          <Button
            key={category.id}
            variant={selectedCategory === category.id ? "secondary" : "ghost"}
            className="w-full justify-between"
            onClick={() => onSelectCategory(category.id)}
          >
            <span className="truncate">{category.name}</span>
            <Badge variant="secondary">
              {itemCounts[category.id] || 0}
            </Badge>
          </Button>
        ))}
      </div>
    </ScrollArea>
  )
}
