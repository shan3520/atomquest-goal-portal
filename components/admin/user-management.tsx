"use client";

import { useState } from "react";
import { updateUserRole, createUser } from "@/app/actions/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Loader2, Users, Search } from "lucide-react";
import type { Profile } from "@/types";

export function UsersManager({ initialUsers }: { initialUsers: Profile[] }) {
  const [users] = useState(initialUsers);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newUser, setNewUser] = useState({
    email: "", password: "", name: "", role: "employee", department: "", manager_id: "",
  });

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const managers = users.filter(u => u.role === "manager");

  const roleBadge: Record<string, string> = {
    employee: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    manager: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    admin: "bg-red-500/20 text-red-400 border-red-500/30",
  };

  async function handleRoleChange(userId: string, role: string) {
    const result = await updateUserRole(userId, role);
    if (result.error) toast.error(result.error);
    else toast.success("Role updated");
  }

  async function handleCreate() {
    setLoading(true);
    const result = await createUser(
      newUser.email, newUser.password, newUser.name,
      newUser.role, newUser.department, newUser.manager_id || undefined
    );
    if (result.error) toast.error(result.error);
    else { toast.success("User created!"); setCreateOpen(false); }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">User management</h1>
          <p className="text-muted-foreground mt-1">{users.length} users</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4 mr-2" />Add user</Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users..." className="pl-10 bg-background/50" />
      </div>

      <div className="grid gap-3">
        {filtered.length === 0 && (
          <Card className="glass-card border-dashed">
            <CardContent className="py-12 text-center">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium">
                {users.length === 0 ? "No users yet" : "No users match your search"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {users.length === 0
                  ? "Add your first user to get started."
                  : `Try a different search term, or clear the filter to see all ${users.length} users.`}
              </p>
            </CardContent>
          </Card>
        )}
        {filtered.map((u) => (
          <Card key={u.id} className="glass-card">
            <CardContent className="py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                  {u.name?.charAt(0) || "?"}
                </div>
                <div>
                  <p className="font-medium">{u.name}</p>
                  <p className="text-sm text-muted-foreground">{u.email}</p>
                  {u.department && <p className="text-xs text-muted-foreground">{u.department}</p>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Select defaultValue={u.role} onValueChange={(v) => v && handleRoleChange(u.id, v)}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create new user</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Name</Label>
              <Input value={newUser.name} onChange={(e) => setNewUser({...newUser, name: e.target.value})} /></div>
            <div className="space-y-2"><Label>Email</Label>
              <Input type="email" value={newUser.email} onChange={(e) => setNewUser({...newUser, email: e.target.value})} /></div>
            <div className="space-y-2"><Label>Password</Label>
              <Input type="password" value={newUser.password} onChange={(e) => setNewUser({...newUser, password: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Role</Label>
                <Select value={newUser.role} onValueChange={(v) => setNewUser({...newUser, role: v ?? "employee"})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select></div>
              <div className="space-y-2"><Label>Department</Label>
                <Input value={newUser.department} onChange={(e) => setNewUser({...newUser, department: e.target.value})} /></div>
            </div>
            {newUser.role === "employee" && managers.length > 0 && (
              <div className="space-y-2"><Label>Manager</Label>
                <Select value={newUser.manager_id} onValueChange={(v) => setNewUser({...newUser, manager_id: v ?? ""})}>
                  <SelectTrigger><SelectValue placeholder="Select manager" /></SelectTrigger>
                  <SelectContent>
                    {managers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select></div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Create user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
