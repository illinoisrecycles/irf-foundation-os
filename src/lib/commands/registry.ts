import type { CommandItem } from './types'

export const baseCommands: CommandItem[] = [
  // Navigation
  { type: 'link', id: 'nav.dashboard', title: 'Go to Dashboard', href: '/admin', keywords: ['home', 'overview'] },
  { type: 'link', id: 'nav.inbox', title: 'Go to Work Inbox', href: '/admin/inbox', keywords: ['tasks', 'queue', 'todo'] },
  
  // Members
  { type: 'link', id: 'nav.members', title: 'Go to Members', href: '/admin/members', keywords: ['people', 'directory', 'contacts'] },
  { type: 'link', id: 'nav.plans', title: 'Go to Membership Plans', href: '/admin/members/plans', keywords: ['pricing', 'tiers'] },
  
  // Events
  { type: 'link', id: 'nav.events', title: 'Go to Events', href: '/admin/events', keywords: ['calendar', 'conference', 'webinar'] },
  { type: 'link', id: 'nav.registrations', title: 'Go to Registrations', href: '/admin/events/registrations' },
  
  // Finance
  { type: 'link', id: 'nav.donations', title: 'Go to Donations', href: '/admin/donations', keywords: ['gifts', 'giving'] },
  { type: 'link', id: 'nav.payments', title: 'Go to Payments', href: '/admin/payments', keywords: ['transactions', 'revenue'] },
  { type: 'link', id: 'nav.grants', title: 'Go to Grants', href: '/admin/grants', keywords: ['funding', 'awards'] },
  
  // Content
  { type: 'link', id: 'nav.pages', title: 'Go to Pages', href: '/admin/pages', keywords: ['cms', 'content'] },
  { type: 'link', id: 'nav.posts', title: 'Go to Blog/News', href: '/admin/posts', keywords: ['articles', 'announcements'] },
  { type: 'link', id: 'nav.email', title: 'Go to Email Campaigns', href: '/admin/email', keywords: ['newsletter', 'marketing'] },
  
  // Settings
  { type: 'link', id: 'nav.settings', title: 'Go to Settings', href: '/admin/settings', keywords: ['organization', 'config'] },
  
  // Quick Actions
  {
    type: 'action',
    id: 'members.create',
    title: 'Create New Member',
    keywords: ['add member', 'new member'],
    roles: ['owner', 'admin', 'staff'],
    run: (ctx) => ctx.routerPush('/admin/members?create=1'),
  },
  {
    type: 'action',
    id: 'events.create',
    title: 'Create New Event',
    keywords: ['add event', 'new event'],
    roles: ['owner', 'admin', 'staff'],
    run: (ctx) => ctx.routerPush('/admin/events?create=1'),
  },
  {
    type: 'action',
    id: 'donations.record',
    title: 'Record Donation',
    keywords: ['add donation', 'new donation'],
    roles: ['owner', 'admin', 'finance'],
    run: (ctx) => ctx.routerPush('/admin/donations?create=1'),
  },
  {
    type: 'action',
    id: 'finance.export',
    title: 'Export Payments (CSV)',
    keywords: ['download', 'report'],
    roles: ['owner', 'admin', 'finance'],
    run: (ctx) => ctx.routerPush('/admin/payments?export=csv'),
  },
]
