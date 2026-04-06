import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';

export default function MainLayout() {
  return (
    <div className="min-h-screen bg-background grid grid-cols-12" data-testid="main-layout">
      <div className="col-span-3 hidden lg:block">
        <Sidebar />
      </div>
      <div className="col-span-12 lg:col-span-9">
        <Outlet />
      </div>
    </div>
  );
}
