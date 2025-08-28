// components/menu/menu-categories.tsx
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { MoreHorizontal, Edit, Trash2, EyeOff } from "lucide-react"
import type { MenuCategory } from "@/types"

interface MenuCategoriesProps {
  categories: MenuCategory[]
  selectedCategory: string
  onSelectCategory: (categoryId: string) => void
  onEditCategory: (category: MenuCategory) => void
  onDeleteCategory: (categoryId: string) => void
  onToggleCategoryStatus: (categoryId: string, isActive: boolean) => void
  isLoading: boolean
  itemCounts: Record<string, number>
}

export function MenuCategories({
  categories,
  selectedCategory,
  onSelectCategory,
  onEditCategory,
  onDeleteCategory,
  onToggleCategoryStatus,
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
          <div key={category.id} className="flex items-center gap-1">
            <Button
              variant={selectedCategory === category.id ? "secondary" : "ghost"}
              className="flex-1 justify-between"
              onClick={() => onSelectCategory(category.id)}
            >
              <span className={cn("truncate", !category.is_active && "opacity-50")}>
                {category.name}
                {!category.is_active && " (Inactive)"}
              </span>
              <Badge variant="secondary">
                {itemCounts[category.id] || 0}
              </Badge>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEditCategory(category)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onToggleCategoryStatus(category.id, !category.is_active)}
                >
                  <EyeOff className="mr-2 h-4 w-4" />
                  {category.is_active ? 'Deactivate' : 'Activate'}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onDeleteCategory(category.id)}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}
