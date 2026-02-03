'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Calendar, Clock, MapPin, Users, ExternalLink } from 'lucide-react';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  location?: string;
  attendees?: number;
  color?: string;
}

export interface CalendarViewProps {
  entitySlug?: string;
  dateField?: string;
  titleField?: string;
  view?: 'month' | 'week' | 'agenda';
  events?: CalendarEvent[];
}

// Generate sample events for preview
const generateSampleEvents = (): CalendarEvent[] => {
  const today = new Date();
  return [
    {
      id: '1',
      title: 'Reunião com Cliente',
      date: today.toISOString().split('T')[0],
      time: '10:00',
      location: 'Sala 1',
      attendees: 3,
      color: 'blue',
    },
    {
      id: '2',
      title: 'Demo do Produto',
      date: new Date(today.getTime() + 86400000).toISOString().split('T')[0],
      time: '14:00',
      attendees: 5,
      color: 'green',
    },
    {
      id: '3',
      title: 'Follow-up Lead',
      date: new Date(today.getTime() + 86400000 * 2).toISOString().split('T')[0],
      time: '09:00',
      color: 'purple',
    },
  ];
};

export function CalendarView({ entitySlug, dateField, titleField, view = 'agenda', events }: CalendarViewProps) {
  const safeEvents = Array.isArray(events) && events.length > 0 ? events : generateSampleEvents();

  const getEventColor = (color?: string) => {
    const colors: Record<string, string> = {
      blue: 'bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300',
      green: 'bg-green-100 border-green-300 text-green-800 dark:bg-green-900/30 dark:border-green-800 dark:text-green-300',
      red: 'bg-red-100 border-red-300 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300',
      yellow: 'bg-yellow-100 border-yellow-300 text-yellow-800 dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-300',
      purple: 'bg-purple-100 border-purple-300 text-purple-800 dark:bg-purple-900/30 dark:border-purple-800 dark:text-purple-300',
      orange: 'bg-orange-100 border-orange-300 text-orange-800 dark:bg-orange-900/30 dark:border-orange-800 dark:text-orange-300',
    };
    return colors[color || 'blue'] || colors.blue;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  if (view === 'agenda') {
    return (
      <div className="space-y-3">
        {safeEvents.map((event) => (
          <div
            key={event.id}
            className={cn(
              'border-l-4 rounded-r-lg p-3 transition-shadow hover:shadow-md cursor-pointer',
              getEventColor(event.color)
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h4 className="font-medium truncate">{event.title}</h4>
                <div className="flex flex-wrap items-center gap-3 mt-1 text-sm opacity-80">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(event.date)}
                  </span>
                  {event.time && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {event.time}
                    </span>
                  )}
                  {event.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {event.location}
                    </span>
                  )}
                  {event.attendees && (
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {event.attendees}
                    </span>
                  )}
                </div>
              </div>
              <button className="p-1 hover:bg-white/20 rounded">
                <ExternalLink className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Month/Week view - simplified calendar grid
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  
  const days = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-muted p-3 flex items-center justify-between">
        <h3 className="font-semibold">
          {today.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
        </h3>
        <div className="flex gap-1">
          <button className="px-2 py-1 text-sm hover:bg-muted-foreground/10 rounded">←</button>
          <button className="px-2 py-1 text-sm hover:bg-muted-foreground/10 rounded">Hoje</button>
          <button className="px-2 py-1 text-sm hover:bg-muted-foreground/10 rounded">→</button>
        </div>
      </div>
      
      {/* Days header */}
      <div className="grid grid-cols-7 border-b">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
          <div key={day} className="p-2 text-center text-xs font-medium text-muted-foreground">
            {day}
          </div>
        ))}
      </div>
      
      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const isToday = day === today.getDate();
          const dateStr = day ? `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
          const dayEvents = safeEvents.filter(e => e.date === dateStr);
          
          return (
            <div
              key={idx}
              className={cn(
                'min-h-[80px] border-b border-r p-1',
                !day && 'bg-muted/30',
                isToday && 'bg-primary/5'
              )}
            >
              {day && (
                <>
                  <span
                    className={cn(
                      'inline-flex items-center justify-center w-6 h-6 text-sm rounded-full',
                      isToday && 'bg-primary text-primary-foreground'
                    )}
                  >
                    {day}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {dayEvents.slice(0, 2).map((event) => (
                      <div
                        key={event.id}
                        className={cn(
                          'text-xs px-1 py-0.5 rounded truncate cursor-pointer',
                          getEventColor(event.color)
                        )}
                        title={event.title}
                      >
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-xs text-muted-foreground px-1">
                        +{dayEvents.length - 2} mais
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CalendarViewPreview({ entitySlug, view }: CalendarViewProps) {
  return (
    <div className="border rounded-lg p-4 bg-muted/50">
      <p className="text-center text-muted-foreground mb-2">
        📅 Calendar ({view || 'agenda'})
      </p>
      <p className="text-center text-sm font-medium">
        {entitySlug || 'Configure a entidade'}
      </p>
      <div className="grid grid-cols-7 gap-1 mt-3">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
          <div key={i} className="text-center text-xs text-muted-foreground">{d}</div>
        ))}
        {Array.from({ length: 7 }, (_, i) => (
          <div
            key={i}
            className={cn(
              'aspect-square flex items-center justify-center text-xs rounded',
              i === 3 && 'bg-primary text-primary-foreground'
            )}
          >
            {i + 1}
          </div>
        ))}
      </div>
    </div>
  );
}
