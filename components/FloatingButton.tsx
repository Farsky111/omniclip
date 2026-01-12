
import React from 'react';

interface FloatingButtonProps {
  isOpen: boolean;
  onClick: () => void;
  itemCount: number;
}

const FloatingButton: React.FC<FloatingButtonProps> = ({ isOpen, onClick, itemCount }) => {
  return (
    <button
      onClick={onClick}
      className={`fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full shadow-2xl transition-all duration-300 transform hover:scale-110 active:scale-95 ${
        isOpen ? 'bg-red-500 rotate-45' : 'bg-indigo-600'
      }`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-8 w-8 text-white"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d={isOpen ? "M6 18L18 6M6 6l12 12" : "M12 4v16m8-8H4"}
        />
      </svg>
      {!isOpen && itemCount > 0 && (
        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-pink-500 text-[10px] font-bold text-white ring-2 ring-white">
          {itemCount}
        </span>
      )}
    </button>
  );
};

export default FloatingButton;
