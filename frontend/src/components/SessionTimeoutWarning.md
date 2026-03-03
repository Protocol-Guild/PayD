# Session Timeout Warning Feature

This document describes the session timeout warning implementation for the PayD application.

## Overview

The session timeout warning system provides users with a 2-minute warning before their JWT session expires due to inactivity. Users can choose to extend their session or will be automatically logged out.

## Features

### ✅ Implemented Features

1. **Session Inactivity Timer**: Tracks user activity and session TTL
2. **Warning Modal**: Appears 2 minutes before session expiration with countdown
3. **Stay Logged In Button**: Refreshes the JWT token via backend API
4. **Automatic Redirection**: Redirects to login page upon final expiration
5. **Activity Tracking**: Monitors mouse, keyboard, scroll, and touch events

## Components

### 1. `useSessionTimeout` Hook

Location: `/src/hooks/useSessionTimeout.ts`

**Purpose**: Core session management logic

**Key Features**:
- Configurable warning time and session duration
- Activity event listeners (mouse, keyboard, scroll, touch)
- Automatic token refresh via `/api/auth/refresh`
- Session expiration handling
- Cleanup of timers on unmount

**Usage**:
```typescript
const {
  isWarningVisible,
  timeRemaining,
  extendSession,
} = useSessionTimeout({
  warningTime: 2 * 60 * 1000, // 2 minutes
  sessionDuration: 60 * 60 * 1000, // 1 hour
  onExpire: () => console.log('Session expired'),
});
```

### 2. `SessionTimeoutWarning` Component

Location: `/src/components/SessionTimeoutWarning.tsx`

**Purpose**: Visual warning modal with countdown

**Features**:
- Animated modal with glass morphism design
- Real-time countdown display
- Progress bar showing remaining time
- Color-coded urgency (yellow → orange → red)
- "Stay Logged In" and "Log Out Now" buttons
- Responsive design

**Props**:
```typescript
interface SessionTimeoutWarningProps {
  isVisible: boolean;
  timeRemaining: number;
  onExtendSession: () => void;
  onLogout: () => void;
}
```

## Integration

### Frontend Integration

The session timeout is integrated into the main `App.tsx` component:

1. **Hook Initialization**: Session timeout hook is initialized with 2-minute warning
2. **Modal Rendering**: Warning modal conditionally rendered based on `isWarningVisible`
3. **Event Handlers**: Proper handlers for extending session and logout

### Backend Integration

Added refresh endpoint to auth routes:

1. **Route**: `POST /api/auth/refresh`
2. **Controller**: Uses existing `AuthController.refresh` method
3. **Token Refresh**: Validates refresh token and issues new access token

## User Experience

### Normal Flow

1. User logs in and starts using the application
2. After 58 minutes of activity, the session timer starts
3. At 58 minutes (2 minutes before expiration), warning modal appears
4. User sees countdown from 2:00 to 0:00
5. User can click "Stay Logged In" to refresh session
6. Modal disappears and session is extended

### Expiration Flow

1. If user doesn't extend session, countdown reaches 0:00
2. Modal automatically closes
3. JWT token is removed from localStorage
4. User is redirected to `/login?reason=session_expired`
5. Login page shows "Your session expired due to inactivity" message

## Security Features

1. **Automatic Cleanup**: Tokens are removed on expiration
2. **Activity-Based**: Session extends only with user activity
3. **Secure Refresh**: Uses backend refresh endpoint with validation
4. **No Hardcoded Values**: Uses environment variables for backend URL

## Configuration

### Environment Variables

```typescript
// vite-env.d.ts
interface ImportMetaEnv {
  readonly VITE_BACKEND_URL?: string;
}
```

### Default Values

- **Warning Time**: 2 minutes before expiration
- **Session Duration**: 1 hour (matches backend JWT expiration)
- **Backend URL**: `http://localhost:4000` (fallback)

## Testing

### Manual Testing Steps

1. **Login**: Authenticate with Google or GitHub
2. **Wait**: Wait for 58 minutes (or modify timer for testing)
3. **Verify**: Warning modal appears with correct countdown
4. **Test Extend**: Click "Stay Logged In" - modal should disappear
5. **Test Expire**: Wait for full expiration - should redirect to login

### Test Modifications

For faster testing, modify the session duration in `App.tsx`:

```typescript
const {
  isWarningVisible,
  timeRemaining,
  extendSession,
} = useSessionTimeout({
  warningTime: 10 * 1000, // 10 seconds
  sessionDuration: 30 * 1000, // 30 seconds
});
```

## File Structure

```
src/
├── hooks/
│   └── useSessionTimeout.ts          # Core session logic
├── components/
│   ├── SessionTimeoutWarning.tsx      # Warning modal
│   └── __tests__/
│       └── SessionTimeoutWarning.test.tsx  # Tests
├── App.tsx                          # Integration point
├── pages/
│   └── Login.tsx                    # Updated with expiration message
└── vite-env.d.ts                   # Environment types
```

## Browser Compatibility

- **Modern Browsers**: Full support for all features
- **Activity Detection**: Uses standard DOM events
- **Animations**: Framer Motion with fallbacks
- **LocalStorage**: Required for token storage

## Performance Considerations

1. **Event Listeners**: Debounced to prevent excessive calls
2. **Timer Cleanup**: Proper cleanup on component unmount
3. **Memory Leaks**: All timers cleared on expiration
4. **Bundle Size**: Minimal impact with lazy loading

## Future Enhancements

1. **Customizable Timing**: User-configurable session duration
2. **Multiple Warnings**: Additional warnings at different intervals
3. **Audio Alerts**: Optional sound notifications
4. **Session Analytics**: Track session extension patterns
5. **Admin Override**: Admin ability to extend user sessions
