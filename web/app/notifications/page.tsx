'use client';

import { useState } from 'react';
import { useNotifications } from '@/context/NotificationContext';
import Link from 'next/link';
import styles from './notifications.module.css';

export default function NotificationsPage() {
  const { notifications, markAsRead, markAllAsRead } = useNotifications();
  const [filterUnread, setFilterUnread] = useState(false);

  const filteredNotifications = filterUnread
    ? notifications.filter((n) => !n.read)
    : notifications;

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className={styles.container}>
      <Link href="/dashboard" className="btn btn-secondary" style={{ marginBottom: '1rem' }}>
        Back to Dashboard
      </Link>

      <div className={styles.header}>
        <div>
          <h1>Notifications</h1>
          <p>Stay updated with league activity</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllAsRead} className="btn btn-primary">
            Mark All as Read
          </button>
        )}
      </div>

      <div className={styles.filters}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            type="checkbox"
            checked={filterUnread}
            onChange={(e) => setFilterUnread(e.target.checked)}
          />
          Unread Only ({unreadCount})
        </label>
      </div>

      {filteredNotifications.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--text-light)' }}>
            {filterUnread ? 'No unread notifications' : 'No notifications yet'}
          </p>
        </div>
      ) : (
        <div className={styles.notificationsList}>
          {filteredNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`card ${styles.notificationCard} ${
                !notification.read ? styles.unread : ''
              }`}
              onClick={() => markAsRead(notification.id)}
            >
              <div className={styles.notificationContent}>
                <div className={styles.notificationHeader}>
                  <h3>{notification.title}</h3>
                  <span
                    className={`badge ${
                      notification.type === 'ELIMINATED'
                        ? 'badge-danger'
                        : notification.type === 'LEAGUE_WINNER'
                        ? 'badge-success'
                        : 'badge-primary'
                    }`}
                  >
                    {notification.type === 'ROUND_OPENED' && '🔓 Round Opened'}
                    {notification.type === 'ROUND_LOCKED' && 'Round Locked'}
                    {notification.type === 'ELIMINATED' && 'Eliminated'}
                    {notification.type === 'LEAGUE_WINNER' && '🎉 Winner'}
                    {notification.type === 'ADMIN_MESSAGE' && 'Announcement'}
                  </span>
                </div>
                <p>{notification.message}</p>
                <small style={{ color: 'var(--text-light)' }}>
                  {new Date(notification.sentAt.toDate()).toLocaleString()}
                </small>
              </div>
              {!notification.read && <div className={styles.unreadIndicator} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
