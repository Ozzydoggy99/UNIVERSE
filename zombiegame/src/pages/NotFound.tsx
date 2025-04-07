import React from 'react';
import { Link } from 'wouter';
import { Button } from '../components/ui/button';

const NotFound: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
      <h1 className="text-5xl font-bold text-red-500 mb-4">404</h1>
      <p className="text-2xl mb-8">Page Not Found</p>
      <p className="text-gray-400 text-center max-w-md mb-8">
        The page you're looking for has been consumed by zombies. Better head back to safety.
      </p>
      <Link href="/">
        <Button className="bg-red-600 hover:bg-red-700">
          Back to Safety
        </Button>
      </Link>
    </div>
  );
};

export default NotFound;