import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import SessionTimeoutWarning from '../SessionTimeoutWarning';

const mockProps = {
  isVisible: true,
  timeRemaining: 120000, // 2 minutes
  onExtendSession: jest.fn(),
  onLogout: jest.fn(),
};

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('SessionTimeoutWarning', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders when visible', () => {
    renderWithRouter(<SessionTimeoutWarning {...mockProps} />);
    
    expect(screen.getByText('Session Expiring Soon')).toBeInTheDocument();
    expect(screen.getByText('Stay Logged In')).toBeInTheDocument();
    expect(screen.getByText('Log Out Now')).toBeInTheDocument();
  });

  it('does not render when not visible', () => {
    renderWithRouter(<SessionTimeoutWarning {...mockProps} isVisible={false} />);
    
    expect(screen.queryByText('Session Expiring Soon')).not.toBeInTheDocument();
  });

  it('displays correct time format', () => {
    renderWithRouter(<SessionTimeoutWarning {...mockProps} timeRemaining={65000} />);
    
    expect(screen.getByText('1:05')).toBeInTheDocument();
  });

  it('calls onExtendSession when Stay Logged In is clicked', () => {
    renderWithRouter(<SessionTimeoutWarning {...mockProps} />);
    
    fireEvent.click(screen.getByText('Stay Logged In'));
    expect(mockProps.onExtendSession).toHaveBeenCalledTimes(1);
  });

  it('calls onLogout when Log Out Now is clicked', () => {
    renderWithRouter(<SessionTimeoutWarning {...mockProps} />);
    
    fireEvent.click(screen.getByText('Log Out Now'));
    expect(mockProps.onLogout).toHaveBeenCalledTimes(1);
  });

  it('shows warning message about security', () => {
    renderWithRouter(<SessionTimeoutWarning {...mockProps} />);
    
    expect(screen.getByText(/For your security, you'll be automatically logged out/)).toBeInTheDocument();
  });
});
