import React, { createContext, useContext, useState } from 'react';

const MeetingContext = createContext(null);

export function MeetingProvider({ children }) {
  const [userName, setUserName] = useState('');
  const [scheduledMeetings, setScheduledMeetings] = useState([]);

  const addScheduledMeeting = (meeting) => {
    setScheduledMeetings((prev) => [...prev, meeting]);
  };

  const removeScheduledMeeting = (id) => {
    setScheduledMeetings((prev) => prev.filter((m) => m.id !== id));
  };

  return (
    <MeetingContext.Provider
      value={{ userName, setUserName, scheduledMeetings, addScheduledMeeting, removeScheduledMeeting }}
    >
      {children}
    </MeetingContext.Provider>
  );
}

export function useMeeting() {
  return useContext(MeetingContext);
}
