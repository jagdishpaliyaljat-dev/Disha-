# Mandatory Google Login Gate Spec

## Goal
Implement a root-level mandatory Google Login Gate in the Disha 20-20 Exam Prep app. When users open the app, they must see only the Login Screen (with Google Sign-In). Access to all application features, syllabus, tests, and tabs is strictly gated until authentication is complete.

## Requirements
1. **Root Auth Gating**:
   - On initial mount, while reading existing Supabase session (`isAuthReady === false`), display a polished splash loader with the app branding.
   - If unauthenticated (`!isAuthenticated` or profile lacks valid authenticated email), render ONLY `LoginPage`.
   - Hide the `Header`, `BottomNav`, `main` content, and floating AI assistant completely until logged in.
2. **Dedicated Google Login Screen (`LoginPage.tsx`)**:
   - In mandatory mode (`isMandatory={true}` or when `onClose` is omitted), hide the "Close" button so users cannot bypass login.
   - Sole authentication method is Google Sign-In ("Continue with Google" button), supporting Native One-Tap on Android and OAuth redirect.
   - Clean UI showcasing key benefits (PYQ Practice, Live Mock Tests, Official Vault, Smart Analytics) along with Terms & Privacy Policy links.
3. **Session Persistence**:
   - Existing active sessions in Supabase / Local Storage auto-login smoothly on cold start without forcing the user to log in every time.
4. **Clean Logout**:
   - When a user logs out, clear user session, storage, and reset `isAuthenticated` to `false`, immediately redirecting back to the Login Screen.
