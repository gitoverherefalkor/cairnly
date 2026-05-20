
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const AuthNavigation = () => {
  const navigate = useNavigate();

  return (
    <Button
      variant="ghost"
      onClick={() => navigate('/')}
      className="text-sm text-white/70 hover:text-white hover:bg-white/5 font-semibold"
    >
      <ArrowLeft className="h-4 w-4 mr-2" />
      Back to Homepage
    </Button>
  );
};

export default AuthNavigation;
