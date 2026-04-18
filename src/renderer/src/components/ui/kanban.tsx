import * as React from 'react'
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type Active,
  type DraggableAttributes,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '@renderer/lib/utils'

type KanbanValue<T> = Record<string, T[]>

type KanbanContextValue<T> = {
  value: KanbanValue<T>
  getItemValue: (item: T) => string
  activeItem: T | null
  activeColumn: string | null
  activeType: 'item' | 'column' | null
}

const KanbanContext = React.createContext<KanbanContextValue<unknown> | null>(null)

function useKanbanContext<T>(): KanbanContextValue<T> {
  const context = React.useContext(KanbanContext)
  if (!context) {
    throw new Error('Kanban components must be used within <Kanban>.')
  }
  return context as KanbanContextValue<T>
}

export function Kanban<T>({
  value,
  onValueChange,
  getItemValue,
  children
}: {
  value: KanbanValue<T>
  onValueChange: (value: KanbanValue<T>) => void
  getItemValue: (item: T) => string
  children: React.ReactNode
}): JSX.Element {
  const [active, setActive] = React.useState<Active | null>(null)

  const columnOrder = React.useMemo(() => Object.keys(value), [value])

  const itemIndex = React.useMemo(() => {
    const index = new Map<string, { column: string; item: T }>()
    for (const [column, items] of Object.entries(value)) {
      for (const item of items) {
        index.set(getItemValue(item), { column, item })
      }
    }
    return index
  }, [getItemValue, value])

  const activeType = active?.data.current?.type as 'item' | 'column' | undefined
  const activeColumn = active
    ? activeType === 'column'
      ? String(active.id)
      : (itemIndex.get(String(active.id))?.column ?? null)
    : null
  const activeItem =
    active && activeType === 'item' ? (itemIndex.get(String(active.id))?.item ?? null) : null

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  const findColumn = React.useCallback(
    (id: string | number): string | null => {
      const key = String(id)
      if (Object.prototype.hasOwnProperty.call(value, key)) return key
      return itemIndex.get(key)?.column ?? null
    },
    [itemIndex, value]
  )

  const moveItem = React.useCallback(
    (
      sourceColumn: string,
      targetColumn: string,
      itemId: string,
      overId?: string
    ): KanbanValue<T> => {
      const sourceItems = value[sourceColumn] ?? []
      const targetItems = value[targetColumn] ?? []
      const sourceIndex = sourceItems.findIndex((item) => getItemValue(item) === itemId)
      if (sourceIndex === -1) return value

      const item = sourceItems[sourceIndex]

      if (sourceColumn === targetColumn) {
        const targetIndex = overId
          ? sourceItems.findIndex((candidate) => getItemValue(candidate) === overId)
          : sourceItems.length - 1
        if (targetIndex === -1 || targetIndex === sourceIndex) return value
        return {
          ...value,
          [sourceColumn]: arrayMove(sourceItems, sourceIndex, targetIndex)
        }
      }

      const nextSourceItems = sourceItems.filter((candidate) => getItemValue(candidate) !== itemId)
      const targetIndex = overId
        ? targetItems.findIndex((candidate) => getItemValue(candidate) === overId)
        : targetItems.length
      const insertionIndex = targetIndex === -1 ? targetItems.length : targetIndex
      const nextTargetItems = [...targetItems]
      nextTargetItems.splice(insertionIndex, 0, item)

      return {
        ...value,
        [sourceColumn]: nextSourceItems,
        [targetColumn]: nextTargetItems
      }
    },
    [getItemValue, value]
  )

  const handleDragStart = React.useCallback((event: DragStartEvent) => {
    setActive(event.active)
  }, [])

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const activeId = String(event.active.id)
      const overId = event.over ? String(event.over.id) : null
      const dragType = event.active.data.current?.type as 'item' | 'column' | undefined

      setActive(null)

      if (!overId || !dragType) return

      if (dragType === 'column') {
        if (activeId === overId) return
        const oldIndex = columnOrder.indexOf(activeId)
        const newIndex = columnOrder.indexOf(overId)
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return

        const nextOrder = arrayMove(columnOrder, oldIndex, newIndex)
        const nextValue: KanbanValue<T> = {}
        for (const column of nextOrder) {
          nextValue[column] = value[column] ?? []
        }
        onValueChange(nextValue)
        return
      }

      const sourceColumn = findColumn(activeId)
      const targetColumn = findColumn(overId)
      if (!sourceColumn || !targetColumn) return

      const nextValue = moveItem(
        sourceColumn,
        targetColumn,
        activeId,
        Object.prototype.hasOwnProperty.call(value, overId) ? undefined : overId
      )

      if (nextValue !== value) {
        onValueChange(nextValue)
      }
    },
    [columnOrder, findColumn, moveItem, onValueChange, value]
  )

  const contextValue = React.useMemo<KanbanContextValue<T>>(
    () => ({
      value,
      getItemValue,
      activeItem,
      activeColumn,
      activeType: activeType ?? null
    }),
    [activeColumn, activeItem, activeType, getItemValue, value]
  )

  return (
    <KanbanContext.Provider value={contextValue as KanbanContextValue<unknown>}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {children}
      </DndContext>
    </KanbanContext.Provider>
  )
}

export function KanbanBoard({
  className,
  children
}: {
  className?: string
  children: React.ReactNode
}): JSX.Element {
  const { value } = useKanbanContext<unknown>()
  const columnOrder = React.useMemo(() => Object.keys(value), [value])

  return (
    <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
      <div className={cn('grid gap-3', className)}>{children}</div>
    </SortableContext>
  )
}

const KanbanColumnHandleContext = React.createContext<{
  attributes: DraggableAttributes
  listeners: ReturnType<typeof useSortable>['listeners']
} | null>(null)

export function KanbanColumn({
  value,
  className,
  children
}: {
  value: string
  className?: string
  children: React.ReactNode
}): JSX.Element {
  const { setNodeRef, isOver } = useDroppable({ id: value })
  const {
    attributes,
    listeners,
    setNodeRef: setSortableNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: value,
    data: { type: 'column' }
  })

  const mergedRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      setNodeRef(node)
      setSortableNodeRef(node)
    },
    [setNodeRef, setSortableNodeRef]
  )

  return (
    <div
      ref={mergedRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex min-h-[24rem] min-w-0 flex-col rounded-lg border border-border/80 bg-muted/20 p-3',
        isOver && 'border-primary/60 bg-primary/5',
        isDragging && 'opacity-70',
        className
      )}
      data-kanban-column={value}
    >
      <KanbanColumnHandleContext.Provider value={{ attributes, listeners }}>
        {children}
      </KanbanColumnHandleContext.Provider>
    </div>
  )
}

export function KanbanColumnHandle({
  asChild,
  children
}: {
  asChild?: boolean
  children: React.ReactNode
}): JSX.Element {
  const context = React.useContext(KanbanColumnHandleContext)
  if (!context) {
    throw new Error('KanbanColumnHandle must be used within KanbanColumn.')
  }

  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      {...context.attributes}
      {...context.listeners}
      {...(!asChild
        ? {
            type: 'button' as const,
            className: 'cursor-grab active:cursor-grabbing'
          }
        : {})}
    >
      {children}
    </Comp>
  )
}

export function KanbanItem({
  value,
  asChild,
  asHandle = false,
  className,
  children
}: {
  value: string
  asChild?: boolean
  asHandle?: boolean
  className?: string
  children: React.ReactNode
}): JSX.Element {
  const Comp = asChild ? Slot : 'div'
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: value,
    data: { type: 'item' }
  })

  return (
    <Comp
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(asChild ? undefined : 'block', isDragging && 'opacity-40', className)}
      {...attributes}
      {...(asHandle ? listeners : undefined)}
    >
      {children}
    </Comp>
  )
}

export function KanbanOverlay({
  children
}: {
  children:
    | React.ReactNode
    | ((context: {
        activeItem: unknown | null
        activeColumn: string | null
        activeType: 'item' | 'column' | null
      }) => React.ReactNode)
}): JSX.Element {
  const { activeItem, activeColumn, activeType } = useKanbanContext<unknown>()

  return (
    <DragOverlay>
      {typeof children === 'function'
        ? children({ activeItem, activeColumn, activeType })
        : children}
    </DragOverlay>
  )
}
