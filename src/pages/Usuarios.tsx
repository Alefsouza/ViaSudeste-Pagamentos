import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import pb from '@/lib/pocketbase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Loader2,
  Plus,
  Users as UsersIcon,
  Shield,
  MapPin,
  Mail,
  Loader,
  Pencil,
  Trash2,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { extractFieldErrors } from '@/lib/pocketbase/errors'
import { useRealtime } from '@/hooks/use-realtime'

export default function Usuarios() {
  const { user } = useAuth()
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [createSubmitting, setCreateSubmitting] = useState(false)

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editingUser, setEditingUser] = useState<any>(null)

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)
  const [deletingUser, setDeletingUser] = useState<any>(null)

  const [email, setEmail] = useState('')
  const [nome, setNome] = useState('')
  const [senha, setSenha] = useState('')
  const [garagem, setGaragem] = useState('')
  const [role, setRole] = useState<'Administrador' | 'recebedoria' | 'DP'>('recebedoria')

  const fetchUsers = async (showLoader = true) => {
    if (showLoader) setLoading(true)
    try {
      const records = await pb.collection('users').getFullList({ sort: '-created' })
      setUsers(records)
    } catch (err) {
      toast.error('Erro ao carregar usuários')
    } finally {
      if (showLoader) setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers(true)
  }, [])

  useRealtime('users', () => {
    fetchUsers(false)
  })

  const openCreateDialog = () => {
    setEmail('')
    setNome('')
    setSenha('')
    setGaragem('')
    setRole('recebedoria')
    setIsCreateDialogOpen(true)
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateSubmitting(true)

    if (!garagem) {
      toast.error('Selecione uma garagem')
      setCreateSubmitting(false)
      return
    }

    try {
      await pb.collection('users').create({
        email,
        password: senha,
        passwordConfirm: senha,
        name: nome,
        garagem,
        tipo_usuario: role,
      })
      toast.success('Usuário criado com sucesso')
      setIsCreateDialogOpen(false)
    } catch (err) {
      const errors = extractFieldErrors(err)
      const firstError = Object.values(errors)[0]
      toast.error(firstError || 'Erro ao criar usuário. Verifique os dados.')
    } finally {
      setCreateSubmitting(false)
    }
  }

  const openEditDialog = (u: any) => {
    setEditingUser(u)
    setEmail(u.email)
    setNome(u.name || '')
    setGaragem(u.garagem || '')
    setRole(u.tipo_usuario || 'recebedoria')
    setIsEditDialogOpen(true)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return
    setEditSubmitting(true)

    if (!garagem) {
      toast.error('Selecione uma garagem')
      setEditSubmitting(false)
      return
    }

    try {
      await pb.collection('users').update(editingUser.id, {
        email,
        name: nome,
        garagem,
        tipo_usuario: role,
      })
      toast.success('Usuário atualizado com sucesso')
      setIsEditDialogOpen(false)
      setEditingUser(null)
    } catch (err) {
      const errors = extractFieldErrors(err)
      const firstError = Object.values(errors)[0]
      toast.error(firstError || 'Erro ao atualizar usuário. Verifique os dados.')
    } finally {
      setEditSubmitting(false)
    }
  }

  const openDeleteDialog = (u: any) => {
    setDeletingUser(u)
    setIsDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!deletingUser) return
    setDeleteSubmitting(true)

    try {
      await pb.collection('users').delete(deletingUser.id)
      toast.success('Usuário excluído com sucesso')
      setIsDeleteDialogOpen(false)
      setDeletingUser(null)
    } catch (err) {
      toast.error('Erro ao excluir usuário.')
    } finally {
      setDeleteSubmitting(false)
    }
  }

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <UsersIcon className="h-8 w-8 text-forest" />
            Gerenciamento de Usuários
          </h1>
          <p className="text-slate-500 mt-1">Crie e gerencie os acessos ao sistema.</p>
        </div>

        <Button onClick={openCreateDialog} className="bg-forest hover:bg-forest/90">
          <Plus className="h-4 w-4 mr-2" />
          Novo Usuário
        </Button>
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Criar Novo Usuário</DialogTitle>
            <DialogDescription>
              Preencha os dados abaixo para cadastrar um novo usuário no sistema.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="senha">Senha</Label>
              <Input
                id="senha"
                type="password"
                required
                minLength={8}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="garagem">Garagem</Label>
              <Select value={garagem} onValueChange={setGaragem}>
                <SelectTrigger id="garagem">
                  <SelectValue placeholder="Selecione a garagem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cursino">Cursino</SelectItem>
                  <SelectItem value="Sapopemba">Sapopemba</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="permissao">Permissão de Acesso</Label>
              <Select value={role} onValueChange={(v: any) => setRole(v)}>
                <SelectTrigger id="permissao">
                  <SelectValue placeholder="Selecione um papel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Administrador">Admin</SelectItem>
                  <SelectItem value="recebedoria">Recebedoria</SelectItem>
                  <SelectItem value="DP">DP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createSubmitting}
                className="bg-forest hover:bg-forest/90"
              >
                {createSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Usuário
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>Atualize os dados do usuário abaixo.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-email">E-mail</Label>
              <Input
                id="edit-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-nome">Nome</Label>
              <Input
                id="edit-nome"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-garagem">Garagem</Label>
              <Select value={garagem} onValueChange={setGaragem}>
                <SelectTrigger id="edit-garagem">
                  <SelectValue placeholder="Selecione a garagem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cursino">Cursino</SelectItem>
                  <SelectItem value="Sapopemba">Sapopemba</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-permissao">Permissão de Acesso</Label>
              <Select value={role} onValueChange={(v: any) => setRole(v)}>
                <SelectTrigger id="edit-permissao">
                  <SelectValue placeholder="Selecione um papel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Administrador">Admin</SelectItem>
                  <SelectItem value="recebedoria">Recebedoria</SelectItem>
                  <SelectItem value="DP">DP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
                disabled={editSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={editSubmitting}
                className="bg-forest hover:bg-forest/90"
              >
                {editSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Alterações
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSubmitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDeleteConfirm()
              }}
              disabled={deleteSubmitting}
              className="bg-rose-600 hover:bg-rose-700 focus:ring-rose-600"
            >
              {deleteSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Garagem</TableHead>
                <TableHead>Nível de Acesso</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center">
                    <Loader className="h-6 w-6 animate-spin mx-auto text-slate-400" />
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-slate-500">
                    Nenhum usuário encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name || 'N/A'}</TableCell>
                    <TableCell className="text-slate-500 flex items-center gap-2">
                      <Mail className="h-3 w-3" /> {u.email}
                    </TableCell>
                    <TableCell>
                      {u.garagem ? (
                        <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 text-sm">
                          <MapPin className="h-3.5 w-3.5" /> {u.garagem}
                        </span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="flex w-fit items-center gap-1">
                        <Shield className="h-3 w-3" />
                        {u.tipo_usuario === 'Administrador'
                          ? 'Admin'
                          : u.tipo_usuario === 'recebedoria'
                            ? 'Recebedoria'
                            : 'DP'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(u)}
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4 text-slate-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(u)}
                        disabled={u.id === user?.id}
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                        title={
                          u.id === user?.id ? 'Não é possível excluir o próprio usuário' : 'Excluir'
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
