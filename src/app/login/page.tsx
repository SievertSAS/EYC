"use client";

import { Suspense, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fullSync } from "@/lib/supabase/sync-engine";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, Mail, Lock } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";

// ============================================================
//  Página de Login — Supabase Auth (email/password)
//  En modo desarrollo (sin Supabase), muestra bypass
// ============================================================

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(
          authError.message === "Invalid login credentials"
            ? "Credenciales incorrectas. Verifica tu email y contraseña."
            : authError.message
        );
        return;
      }

      // Sincronizar datos maestros (incluyendo técnicos) al login
      try {
        await fullSync();
      } catch {
        // Sync puede fallar en primera carga, no bloquea el login
        console.warn("[Login] Sync inicial falló, continuando...");
      }

      router.push(redirect);
      router.refresh();
    } catch {
      setError("Error de conexión. Verifica tu internet.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center gradient-bg p-4">
      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Image
            src="/logo-sievert.png"
            alt="Sievert EyC"
            width={240}
            height={80}
            className="object-contain"
            priority
          />
        </div>

        <Card className="border-none shadow-2xl rounded-3xl bg-white overflow-hidden">
          <CardContent className="p-0">
            {/* Header */}
            <div className="bg-gradient-to-br from-primary/5 to-primary/10 p-6 sm:p-8 border-b border-primary/10">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                Iniciar Sesión
              </h1>
              <p className="text-slate-500 font-medium text-sm mt-1">
                Ingresa tus credenciales para continuar
              </p>
            </div>

            <div className="p-6 sm:p-8">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      type="email"
                      className="pl-10 rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                      placeholder="tu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                    Contraseña
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      type="password"
                      className="pl-10 rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                    />
                  </div>
                </div>

                {error && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full rounded-xl font-black bg-primary hover:bg-primary/90 text-white h-12"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Ingresando...
                    </>
                  ) : (
                    "Ingresar"
                  )}
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 font-medium mt-6">
          Sievert EyC — Protección Radiológica
        </p>
      </div>
    </div>
  );
}
