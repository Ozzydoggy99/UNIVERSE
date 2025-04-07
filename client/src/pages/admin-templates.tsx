import { useEffect } from 'react';
import { Redirect } from 'wouter';
import { TemplateManager } from '@/components/templates/template-manager';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { LayoutTemplate, ArrowLeft, Home } from 'lucide-react';
import { Link } from 'wouter';

export default function AdminTemplates() {
  const { user } = useAuth();

  // If not logged in or not admin, redirect
  if (!user) {
    return <Redirect to="/auth" />;
  }
  
  if (user.role !== 'admin') {
    return <Redirect to="/" />;
  }

  return (
    <div className="min-h-screen bg-neutral-light">
      <header className="bg-white shadow-sm p-4 mb-4">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center">
            <LayoutTemplate className="text-primary h-6 w-6 mr-2" />
            <h1 className="text-xl font-bold">Template Manager</h1>
          </div>
          <div className="flex space-x-2">
            <Link href="/">
              <Button variant="outline" size="sm">
                <Home className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4">
        <TemplateManager />
      </main>
    </div>
  );
}