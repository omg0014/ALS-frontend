import { createContext, useContext } from 'react'

// { user, logout } for the logged-in user. Provided by App.
export const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)
