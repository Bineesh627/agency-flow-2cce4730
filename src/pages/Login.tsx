import { useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

interface FormValues {
  email: string;
  password: string;
}

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>();

  if (!isLoading && user) {
    const from = (location.state as any)?.from?.pathname ?? "/dashboard";
    return <Navigate to={from} replace />;
  }

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email.trim(),
      password: values.password,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back");
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Warm amber glow radials */}
      <div className="absolute -top-40 -left-40 h-[28rem] w-[28rem] rounded-full bg-primary/20 blur-[140px]" />
      <div className="absolute -bottom-40 -right-40 h-[28rem] w-[28rem] rounded-full bg-primary/10 blur-[160px]" />

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        <div className="flex items-center justify-center gap-3 mb-10">
          <img src={logo} alt="CorePro Techno LLP" className="h-12 w-12 rounded-xl object-contain glow-primary" />
          <h1 className="font-serif-display text-2xl font-semibold leading-tight text-foreground">
            CorePro<br />
            <span className="text-amber-accent">Techno LLP</span>
          </h1>
        </div>
        <div className="card-editorial p-9">
          <p className="micro-label mb-3">Welcome back</p>
          <h2 className="font-serif-display text-3xl font-semibold mb-3">Sign in</h2>
          <div className="amber-divider mb-6 w-16" />
          <p className="text-sm text-muted-foreground mb-7">
            Access your CorePro workspace
          </p>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="micro-label">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@agency.com"
                autoComplete="email"
                {...register("email", { required: "Email is required" })}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="micro-label">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className="pr-10"
                  {...register("password", { required: "Password is required" })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full btn-amber h-12 mt-2" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Sign in
            </Button>
          </form>
          <p className="text-xs text-muted-foreground mt-7 text-center tracking-wide">
            No account? Contact your administrator.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
