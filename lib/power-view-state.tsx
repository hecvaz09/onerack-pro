'use client';
import {createContext} from 'react';

// Settings may block writes without blocking zoom, panning, or saved-cord inspection.
export const PowerViewStateContext=createContext(false);
