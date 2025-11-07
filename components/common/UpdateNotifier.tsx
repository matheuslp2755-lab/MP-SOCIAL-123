import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';

const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

const UpdateNotifier: React.FC = () => {
    const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
    const currentVersionRef = useRef<string | null>(null);
    const { t } = useLanguage();

    const checkForUpdates = async () => {
        try {
            // Adiciona um parâmetro de cache-busting para garantir que obtemos o arquivo mais recente
            const response = await fetch(`/version.json?t=${new Date().getTime()}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch version.json: ${response.statusText}`);
            }
            const data = await response.json();
            
            if (!currentVersionRef.current) {
                // Primeira carga, armazena a versão atual de quando o aplicativo foi inicializado
                currentVersionRef.current = data.version;
            } else if (currentVersionRef.current !== data.version) {
                // Uma nova versão foi detectada
                setIsUpdateAvailable(true);
            }
        } catch (error) {
            console.error('Failed to check for updates:', error);
        }
    };

    useEffect(() => {
        // Verifica imediatamente na montagem do componente
        checkForUpdates();

        // Configura um intervalo para verificar periodicamente
        const intervalId = setInterval(checkForUpdates, CHECK_INTERVAL);

        // Também verifica quando a aba se torna visível novamente
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkForUpdates();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Limpa na desmontagem do componente
        return () => {
            clearInterval(intervalId);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    const handleReload = () => {
        window.location.reload();
    };

    if (!isUpdateAvailable) {
        return null;
    }

    return (
        <div className="fixed bottom-4 right-4 bg-sky-500 text-white p-4 rounded-lg shadow-lg z-50 flex items-center gap-4 animate-fade-in-up">
            <p className="font-semibold">{t('update.available')}</p>
            <button 
                onClick={handleReload}
                className="bg-white text-sky-600 font-bold py-1 px-3 rounded-md hover:bg-sky-100 transition-colors"
            >
                {t('update.reload')}
            </button>
        </div>
    );
};

export default UpdateNotifier;
