import React from 'react';
import { DashboardProvider } from '../context/DashboardContext';
import DashboardCard from './DashboardCard';

const Dashboard = () => {
  return (
    <DashboardProvider>
      <div className="dashboard-container">
        <DashboardCard title="Overview">
          <p>Key metrics and summary data</p>
        </DashboardCard>
        
        <DashboardCard title="Analytics">
          <p>Detailed analytics and charts</p>
        </DashboardCard>
        
        <DashboardCard title="Recent Activity">
          <p>Latest user activities and events</p>
        </DashboardCard>
      </div>
    </DashboardProvider>
  );
};

export default Dashboard;
