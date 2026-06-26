import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import EntityLedger from './EntityLedger';
import { vi } from 'vitest';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ name: 'Test Entity' }),
  };
});

describe('EntityLedger Component', () => {
  it('renders without crashing', () => {
    // We expect it to render a title or some element when loaded.
    render(
      <BrowserRouter>
        <EntityLedger />
      </BrowserRouter>
    );
    
    // We just check if it doesn't crash. React Testing Library will throw if render fails.
    expect(true).toBe(true);
  });
});
