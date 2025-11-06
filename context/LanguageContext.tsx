import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db, doc, getDoc, updateDoc } from '../firebase';

// REMOVED static imports of JSON files to use fetch instead.

type Language = 'en' | 'pt';

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => Promise<void>;
  t: (key: string, replacements?: { [key: string]: string | number }) => string;
  loading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const validLanguages: Language[] = ['en', 'pt'];

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('en');
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  const loadTranslations = useCallback(async (lang: Language) => {
    setLoading(true);
    let langToLoad: Language = validLanguages.includes(lang) ? lang : 'en';

    try {
        const response = await fetch(`/locales/${langToLoad}.json`);
        if (!response.ok) {
            console.error(`Failed to load ${langToLoad}.json, falling back to English.`);
            langToLoad = 'en';
            const fallbackResponse = await fetch(`/locales/en.json`);
            if (!fallbackResponse.ok) throw new Error('Failed to load fallback English translations.');
            const newMessages = await fallbackResponse.json();
            setMessages(newMessages);
        } else {
            const newMessages = await response.json();
            setMessages(newMessages);
        }
        setLanguageState(langToLoad);
    } catch (error) {
        console.error("Could not load any translation files.", error);
        setMessages({});
    } finally {
        setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    const fetchUserLanguage = async () => {
        let initialLang: Language = 'en';
        if (currentUser) {
            try {
                const userDocRef = doc(db, 'users', currentUser.uid);
                const userDoc = await getDoc(userDocRef);
                if (userDoc.exists()) {
                    const userLang = userDoc.data().language;
                    if (userLang && validLanguages.includes(userLang)) {
                        initialLang = userLang;
                    }
                }
            } catch (error) {
                console.error("Error fetching user language, defaulting to English.", error);
            }
        }
        await loadTranslations(initialLang);
    };
    fetchUserLanguage();
  }, [currentUser, loadTranslations]);

  const setLanguage = async (lang: Language) => {
    await loadTranslations(lang);
    if (currentUser) {
      try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userDocRef, { language: lang });
      } catch (error) {
        console.error("Failed to update user language preference:", error);
      }
    }
  };

  const t = (key: string, replacements?: { [key:string]: string | number }): string => {
    let message = messages[key] || key;
    if (replacements) {
      Object.keys(replacements).forEach(placeholder => {
        message = message.replace(`{${placeholder}}`, String(replacements[placeholder]));
      });
    }
    return message;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, loading }}>
      {loading ? (
        <div className="bg-zinc-50 dark:bg-black min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-sky-500"></div>
        </div>
      ) : children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
