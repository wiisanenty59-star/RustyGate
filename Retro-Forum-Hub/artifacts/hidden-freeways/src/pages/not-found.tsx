import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 relative overflow-hidden animate-in fade-in duration-500">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-destructive/5 via-background to-background" />
      
      <div className="relative z-10 text-center space-y-6 max-w-md">
        <div className="flex justify-center mb-8">
          <AlertTriangle className="w-24 h-24 text-destructive opacity-80" />
        </div>
        
        <h1 className="font-serif text-5xl text-foreground tracking-widest uppercase">
          404 <span className="text-destructive">LOST</span>
        </h1>
        
        <p className="font-mono text-sm text-muted-foreground uppercase tracking-widest leading-relaxed">
          Signal interrupted. The requested coordinates do not exist in the current grid, or the location has been permanently sealed.
        </p>

        <div className="pt-8">
          <Link href="/">
            <Button variant="outline" className="border-primary/30 text-primary hover:bg-primary/10 rounded-none font-mono text-xs uppercase tracking-wider">
              Return to Dispatch
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
