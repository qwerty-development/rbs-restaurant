// components/tables/table-combinations-manager.tsx
"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Plus, Link, Trash2, RefreshCw } from "lucide-react"
import type { RestaurantTable, RestaurantTableCombinationWithTables } from "@/types"

interface TableCombinationsManagerProps {
  tables: RestaurantTable[]
  combinations: RestaurantTableCombinationWithTables[]
  onCreateCombination: (data: {
    primaryTableId: string
    secondaryTableId: string
    combinedCapacity: number
  }) => void
  onDeleteCombination: (id: string) => void
  onSyncCombinations?: () => void
}

export function TableCombinationsManager({
  tables,
  combinations,
  onCreateCombination,
  onDeleteCombination,
  onSyncCombinations
}: TableCombinationsManagerProps) {
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [primaryTableId, setPrimaryTableId] = useState("")
  const [secondaryTableId, setSecondaryTableId] = useState("")
  const [combinedCapacity, setCombinedCapacity] = useState(0)

  const handleSubmit = () => {
    if (primaryTableId && secondaryTableId && combinedCapacity > 0) {
      onCreateCombination({
        primaryTableId,
        secondaryTableId,
        combinedCapacity
      })
      setShowAddDialog(false)
      setPrimaryTableId("")
      setSecondaryTableId("")
      setCombinedCapacity(0)
    }
  }

  const getTableTypeColor = (type: string) => {
    const colors = {
      booth: "bg-primary/20 text-primary",
      window: "bg-accent/30 text-accent-foreground",
      patio: "bg-secondary/50 text-secondary-foreground",
      standard: "bg-muted text-muted-foreground",
      bar: "bg-accent/40 text-accent-foreground",
      private: "bg-primary/30 text-primary",
    }
    return colors[type as keyof typeof colors] || colors.standard
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Table Combinations</CardTitle>
              <CardDescription>
                Define which tables can be combined for larger parties
              </CardDescription>
            </div>
            <div className="flex gap-2">
              
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Combination
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Existing Combinations */}
      {combinations.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Link className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              No table combinations defined yet
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {combinations.map((combo) => (
            <Card key={combo.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-2">
                      <Link className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Combined Tables</span>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge className={getTableTypeColor(combo.primary_table.table_type)}>
                          {combo.primary_table.table_type}
                        </Badge>
                        <span className="font-medium">
                          Table {combo.primary_table.table_number}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          (Cap: {combo.primary_table.max_capacity})
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 pl-4">
                        <span className="text-muted-foreground">+</span>
                        <Badge className={getTableTypeColor(combo.secondary_table.table_type)}>
                          {combo.secondary_table.table_type}
                        </Badge>
                        <span className="font-medium">
                          Table {combo.secondary_table.table_number}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          (Cap: {combo.secondary_table.max_capacity})
                        </span>
                      </div>
                    </div>
                    
                    <div className="pt-2 border-t">
                      <span className="text-sm text-muted-foreground">Combined Capacity: </span>
                      <span className="font-semibold">{combo.combined_capacity} guests</span>
                    </div>
                  </div>
                  
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onDeleteCombination(combo.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Combination Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Table Combination</DialogTitle>
            <DialogDescription>
              Select two tables that can be combined for larger parties
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Primary Table</Label>
              <Select value={primaryTableId} onValueChange={setPrimaryTableId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select primary table" />
                </SelectTrigger>
                <SelectContent>
                  {tables
                    .filter(t => t.is_combinable && t.id !== secondaryTableId)
                    .map((table) => (
                      <SelectItem key={table.id} value={table.id}>
                        Table {table.table_number} ({table.table_type} - Capacity: {table.max_capacity})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Secondary Table</Label>
              <Select value={secondaryTableId} onValueChange={setSecondaryTableId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select secondary table" />
                </SelectTrigger>
                <SelectContent>
                  {tables
                    .filter(t => t.is_combinable && t.id !== primaryTableId)
                    .map((table) => (
                      <SelectItem key={table.id} value={table.id}>
                        Table {table.table_number} ({table.table_type} - Capacity: {table.max_capacity})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Combined Capacity</Label>
              <Input
                type="number"
                min="2"
                max="50"
                value={combinedCapacity}
                onChange={(e) => setCombinedCapacity(parseInt(e.target.value) || 0)}
                placeholder="Total capacity when combined"
              />
              {primaryTableId && secondaryTableId && (
                <p className="text-sm text-muted-foreground mt-1">
                  Suggested: {
                    (tables.find(t => t.id === primaryTableId)?.max_capacity || 0) +
                    (tables.find(t => t.id === secondaryTableId)?.max_capacity || 0)
                  } guests
                </p>
              )}
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={!primaryTableId || !secondaryTableId || combinedCapacity <= 0}
              >
                Create Combination
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}