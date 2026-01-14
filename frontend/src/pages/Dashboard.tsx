
import React from 'react';
import { AnimatedBlobs } from '../components/AnimatedBlobs';

const Dashboard = () => {
  return (
    <div className="p-8 bg-white min-h-screen">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Hero Card */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-8 flex flex-row">
          {/* Left Text */}
          <div className="text-center pr-8">
            <p className="text-3xl font-bold text-[#525B44]">2.7</p>
            <p className="text-sm text-[#5A6C57]">Average Score</p>
          </div>

          {/* Center: AnimatedBlobs */}
          <div className="relative mx-4 w-72 h-72">
            <AnimatedBlobs>
              <div className="text-center">
                <p className="text-5xl font-bold text-[#525B44]">84</p>
                <p className="text-base text-[#5A6C57]">New Papers</p>
              </div>
            </AnimatedBlobs>
          </div>

          {/* Right Badge */}
          <div className="text-center pl-8">
             <span className="inline-block bg-[#85A98F] text-white text-xs font-semibold px-3 py-1 rounded-full">
               Recycling
             </span>
             <p className="text-sm text-[#5A6C57] mt-1">Trending Topic</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
