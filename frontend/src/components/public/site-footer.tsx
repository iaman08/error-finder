import { Sparkles } from 'lucide-react';

export const SiteFooter = () => (
  <footer className="border-t border-border/40 bg-background/60">
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between md:px-6">
      <p>Copyright © {new Date().getFullYear()} Shien Ai. All rights reserved.</p>
      <div className="flex items-center gap-2 text-foreground/70">
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        <span className="font-medium tracking-wide">OMNIKENT</span>
      </div>
      <nav className="flex items-center gap-4">
        <span>Quick links:</span>
        <a href="#platform" className="hover:text-foreground">Platform</a>
        <a href="#resources" className="hover:text-foreground">Resources</a>
        <a href="#contact" className="hover:text-foreground">Contact</a>
      </nav>
    </div>
  </footer>
);
