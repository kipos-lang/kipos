import React from 'react';

// from https://flowbite.com/icons/

export const EditIcon = () => (
    <svg
        style={{
            color: 'currentColor',
        }}
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        fill="none"
        viewBox="0 0 24 24"
    >
        <path
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="m14.304 4.844 2.852 2.852M7 7H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-4.5m2.409-9.91a2.017 2.017 0 0 1 0 2.853l-6.844 6.844L8 14l.713-3.565 6.844-6.844a2.015 2.015 0 0 1 2.852 0Z"
        />
    </svg>
);

export const CheckIcon = ({ style }: { style?: React.CSSProperties }) => (
    <svg
        style={style}
        className="w-6 h-6"
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        width="1em"
        height="1em"
        fill="none"
        viewBox="0 0 24 24"
    >
        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 11.917 9.724 16.5 19 7.5" />
    </svg>
);

export const BadgeCheck = ({ style }: { style?: React.CSSProperties }) => (
    <svg
        style={style}
        width="1em"
        height="1em"
        className="w-6 h-6 text-gray-800 dark:text-white"
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        fill="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            fillRule="evenodd"
            d="M12 2c-.791 0-1.55.314-2.11.874l-.893.893a.985.985 0 0 1-.696.288H7.04A2.984 2.984 0 0 0 4.055 7.04v1.262a.986.986 0 0 1-.288.696l-.893.893a2.984 2.984 0 0 0 0 4.22l.893.893a.985.985 0 0 1 .288.696v1.262a2.984 2.984 0 0 0 2.984 2.984h1.262c.261 0 .512.104.696.288l.893.893a2.984 2.984 0 0 0 4.22 0l.893-.893a.985.985 0 0 1 .696-.288h1.262a2.984 2.984 0 0 0 2.984-2.984V15.7c0-.261.104-.512.288-.696l.893-.893a2.984 2.984 0 0 0 0-4.22l-.893-.893a.985.985 0 0 1-.288-.696V7.04a2.984 2.984 0 0 0-2.984-2.984h-1.262a.985.985 0 0 1-.696-.288l-.893-.893A2.984 2.984 0 0 0 12 2Zm3.683 7.73a1 1 0 1 0-1.414-1.413l-4.253 4.253-1.277-1.277a1 1 0 0 0-1.415 1.414l1.985 1.984a1 1 0 0 0 1.414 0l4.96-4.96Z"
            clipRule="evenodd"
        />
    </svg>
);

export const CancelIcon = ({ style }: { style?: React.CSSProperties }) => (
    <svg
        style={style}
        width="1em"
        height="1em"
        className="w-6 h-6 text-gray-800 dark:text-white"
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        fill="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            fillRule="evenodd"
            d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12Zm7.707-3.707a1 1 0 0 0-1.414 1.414L10.586 12l-2.293 2.293a1 1 0 1 0 1.414 1.414L12 13.414l2.293 2.293a1 1 0 0 0 1.414-1.414L13.414 12l2.293-2.293a1 1 0 0 0-1.414-1.414L12 10.586 9.707 8.293Z"
            clipRule="evenodd"
        />
    </svg>
);

export const NeqIcon = ({ style }: { style?: React.CSSProperties }) => (
    <svg
        style={style}
        width="1em"
        height="1em"
        className="w-6 h-6 text-gray-800 dark:text-white"
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        fill="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            fillRule="evenodd"
            d="M 2,12 C 2,6.477 6.477,2 12,2 17.523,2 22,6.477 22,12 22,17.523 17.523,22 12,22 6.477,22 2,17.523 2,12 Z M 14.0625 6.0566406 A 0.94488001 0.94488001 0 0 0 13.123047 6.6484375 L 12.160156 9.0546875 L 7 9.0546875 A 0.94488001 0.94488001 0 0 0 6.0546875 10 A 0.94488001 0.94488001 0 0 0 7 10.945312 L 11.404297 10.945312 L 10.560547 13.054688 L 7 13.054688 A 0.94488001 0.94488001 0 0 0 6.0546875 14 A 0.94488001 0.94488001 0 0 0 7 14.945312 L 9.8046875 14.945312 L 9.1230469 16.648438 A 0.94488001 0.94488001 0 0 0 9.6484375 17.876953 A 0.94488001 0.94488001 0 0 0 10.876953 17.351562 L 11.839844 14.945312 L 17 14.945312 A 0.94488001 0.94488001 0 0 0 17.945312 14 A 0.94488001 0.94488001 0 0 0 17 13.054688 L 12.595703 13.054688 L 13.439453 10.945312 L 17 10.945312 A 0.94488001 0.94488001 0 0 0 17.945312 10 A 0.94488001 0.94488001 0 0 0 17 9.0546875 L 14.195312 9.0546875 L 14.876953 7.3515625 A 0.94488001 0.94488001 0 0 0 14.351562 6.1230469 A 0.94488001 0.94488001 0 0 0 14.0625 6.0566406 z "
            clipRule="evenodd"
        />
    </svg>
);

export const MinusIcon = ({ style }: { style?: React.CSSProperties }) => (
    <svg
        style={style}
        width="1em"
        height="1em"
        className="w-6 h-6 text-gray-800 dark:text-white"
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        fill="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            fillRule="evenodd"
            d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12Zm5.757-1a1 1 0 1 0 0 2h8.486a1 1 0 1 0 0-2H7.757Z"
            clipRule="evenodd"
        />
    </svg>
);
