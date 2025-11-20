import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Checkbox } from '@renderer/components/ui/checkbox'
import { Card, CardContent, CardHeader } from '@renderer/components/ui/card'

export const Route = createFileRoute('/todos')({
  component: Todos,
})

interface Todo {
  id: number
  text: string
  completed: boolean
}

function Todos() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [inputValue, setInputValue] = useState('')

  useEffect(() => {
    loadTodos()
  }, [])

  const loadTodos = async () => {
    const loadedTodos = await window.api.getTodos()
    setTodos(loadedTodos)
  }

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim()) return

    await window.api.addTodo(inputValue)
    setInputValue('')
    loadTodos()
  }

  const handleToggleTodo = async (id: number) => {
    await window.api.toggleTodo(id)
    loadTodos()
  }

  const handleDeleteTodo = async (id: number) => {
    await window.api.deleteTodo(id)
    loadTodos()
  }

  return (
    <div className="flex flex-col gap-4 p-4 h-full">
      <h1 className="text-2xl font-bold tracking-tight">Todo List</h1>
      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardHeader className="border-b px-4 py-3 bg-muted/40">
          <form onSubmit={handleAddTodo} className="flex gap-2">
            <Input
              type="text"
              placeholder="Add a new task..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </form>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto p-0">
          {todos.length === 0 ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              No tasks yet. Add one above!
            </div>
          ) : (
            <ul className="divide-y">
              {todos.map((todo) => (
                <li key={todo.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3 flex-1 overflow-hidden">
                    <Checkbox
                      checked={todo.completed}
                      onCheckedChange={() => handleToggleTodo(todo.id)}
                      id={`todo-${todo.id}`}
                    />
                    <label
                      htmlFor={`todo-${todo.id}`}
                      className={`flex-1 truncate cursor-pointer ${
                        todo.completed ? 'line-through text-muted-foreground' : ''
                      }`}
                    >
                      {todo.text}
                    </label>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteTodo(todo.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

