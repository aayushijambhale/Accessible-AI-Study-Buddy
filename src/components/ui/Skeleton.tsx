import React from "react";

interface SkeletonProps {
  className?: string;
  key?: React.Key | string | number;
}

export const Skeleton = ({ className = "" }: SkeletonProps) => {
  return (
    <div className={`animate-pulse bg-slate-200 rounded ${className}`}></div>
  );
};

export const NoteCardSkeleton = () => (
  <div className="card-soft p-5 border border-slate-100 flex flex-col gap-4">
    <Skeleton className="h-6 w-3/4" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-2/3" />
    <div className="flex justify-between mt-auto pt-4">
      <Skeleton className="h-8 w-20 rounded-full" />
      <Skeleton className="h-8 w-20 rounded-full" />
    </div>
  </div>
);
