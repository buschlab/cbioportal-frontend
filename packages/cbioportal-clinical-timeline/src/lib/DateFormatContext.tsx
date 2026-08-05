import React, { createContext, useContext } from 'react';

// Component that provides the date format

// Define the context
interface DateFormatContextType {
    startDate: string | null;
}

// Create the context
const DateFormatContext = createContext<DateFormatContextType>({
    startDate: null,
});

export const DateFormatProvider: React.FC<{
    children: React.ReactNode;
    startDate: string | null;
}> = ({ children, startDate }) => {
    return (
        <DateFormatContext.Provider
            value={{
                startDate: startDate,
            }}
        >
            {children}
        </DateFormatContext.Provider>
    );
};

// Custom hook
export const useDateFormat = () => {
    const context = useContext(DateFormatContext);
    if (!context) {
        throw new Error(
            'useDateFormat must be used within a DateFormatProvider'
        );
    }
    return context;
};

export default DateFormatContext;
