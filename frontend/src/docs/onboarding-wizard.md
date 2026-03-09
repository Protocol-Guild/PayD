# Organization Onboarding Wizard

A comprehensive guided tour wizard that helps new organizations set up their PayD payroll system with step-by-step guidance.

## Features

### 🎯 4-Step Onboarding Process
1. **Welcome & Organization Setup** - Organization name and overview
2. **Payroll Wallet Setup** - Connect existing wallet or generate new one
3. **Employee Import** - CSV bulk import or manual entry
4. **Payment Configuration** - Global settings and scheduling

### 💳 Payroll Wallet Options
- **Connect Existing Wallet**: Use current Stellar wallet
- **Generate New Wallet**: Create dedicated payroll wallet with secure key generation
- **Secure Key Storage**: Secret key display with security warnings

### 📊 Employee Management
- **CSV Import**: Bulk upload with validation and preview
- **Manual Entry**: Add individual employees
- **Data Validation**: Email format, wallet address validation
- **Template Download**: Sample CSV format for guidance

### ⚙️ Payment Settings
- **Currency Selection**: USDC, XLM, EURC support
- **Flexible Scheduling**: Weekly, biweekly, monthly options
- **Time Configuration**: Processing day and time settings
- **Global Defaults**: Organization-wide payment preferences

## Technical Implementation

### Components Created

#### `OrganizationOnboardingWizard.tsx`
Main wizard component with 4-step navigation, progress tracking, and form validation.

#### `OnboardingWrapper.tsx`
HOC component that wraps the app and shows wizard for new users based on localStorage state.

#### `useOrganizationOnboarding.ts`
Custom hook managing onboarding state, localStorage persistence, and wizard control.

#### `csvParser.ts`
Utility for parsing employee CSV files with validation, template generation, and error handling.

### Integration Points

#### App Integration
```tsx
// App.tsx
<OnboardingWrapper>
  <Routes>
    {/* existing routes */}
  </Routes>
</OnboardingWrapper>
```

#### Settings Integration
Added reset functionality in Settings page for testing and reconfiguration.

### Data Flow

1. **State Management**: localStorage persistence for onboarding completion
2. **Event System**: Custom events for onboarding completion
3. **Validation**: Real-time form validation with user feedback
4. **Error Handling**: Comprehensive error states and recovery options

### UI/UX Features

#### Responsive Design
- Mobile-first approach
- Touch-friendly controls
- Adaptive layouts

#### Accessibility
- Semantic HTML structure
- Keyboard navigation support
- Screen reader compatibility
- High contrast support

#### User Experience
- Progress indicators
- Step validation
- Back/forward navigation
- Cancel with confirmation
- Success feedback

## Usage

### First-Time Users
1. New users automatically see onboarding wizard
2. Complete 4-step setup process
3. Data saved to localStorage
4. Redirect to main application

### Reset/Reconfigure
1. Navigate to Settings page
2. Click "Reset Organization Setup"
3. Wizard appears on next visit
4. Reconfigure as needed

### CSV Import Format
```csv
name,email,role,salary,wallet
John Doe,john@company.com,full-time,5000,GDUK...
Jane Smith,jane@company.com,contractor,3000,
```

## File Structure
```
src/
├── components/
│   ├── OrganizationOnboardingWizard.tsx
│   └── OnboardingWrapper.tsx
├── hooks/
│   └── useOrganizationOnboarding.ts
├── pages/
│   └── OnboardingPage.tsx
├── utils/
│   └── csvParser.ts
└── App.tsx (modified)
```

## Dependencies

### Existing Dependencies Used
- React (hooks, components)
- React Router (navigation)
- Tailwind CSS (styling)
- Stellar SDK (wallet generation)
- i18next (internationalization)

### No Additional Dependencies Required
- Uses existing design system components
- Leverages current notification system
- Integrates with wallet provider

## Security Considerations

### Wallet Security
- Secret key display with warnings
- Secure wallet generation using Stellar SDK
- No key storage in application state

### Data Validation
- Email format validation
- Stellar address format checking
- CSV parsing security
- XSS prevention

### Privacy
- Local storage only (no server transmission)
- No analytics tracking
- User-controlled data

## Testing

### Manual Testing
1. Clear localStorage to simulate new user
2. Complete wizard flow
3. Test CSV import with various formats
4. Test wallet connection/generation
5. Test reset functionality

### Edge Cases
- Empty CSV files
- Invalid wallet addresses
- Network failures
- Browser compatibility

## Future Enhancements

### Potential Improvements
- Multi-language support for wizard
- Advanced CSV mapping
- Employee group management
- Payment preview calculations
- Integration with HR systems

### Analytics Integration
- Onboarding completion tracking
- Step abandonment analysis
- User behavior insights

## Support

For issues or questions about the onboarding wizard:
1. Check browser console for errors
2. Verify localStorage is enabled
3. Test with different CSV formats
4. Reset wizard if needed
