import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import StockList from './StockList';

import { vi } from 'vitest';

// Mock the react-router-dom hooks
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

describe('StockList Component', () => {
  it('renders the StockList title correctly', () => {
    const mockFilters = { group_by_config: false };
    const mockProducts = [];
    
    render(
      <BrowserRouter>
        <StockList 
          products={mockProducts} 
          loading={false} 
          filters={mockFilters} 
          handleFilterChange={vi.fn()} 
          refresh={vi.fn()} 
        />
      </BrowserRouter>
    );
    
    expect(screen.getByText(/PRODUCT NAME/i)).toBeInTheDocument();
  });
});
