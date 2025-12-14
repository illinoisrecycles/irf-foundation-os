export type AppRole = 'owner' | 'admin' | 'staff' | 'finance' | 'member'

export type CommandContext = {
  orgId: string
  role: AppRole
  pathname: string
  routerPush: (href: string) => void
  openModal?: (id: string) => void
}

export type CommandItem =
  | {
      type: 'link'
      id: string
      title: string
      href: string
      keywords?: string[]
      icon?: string
      roles?: AppRole[]
    }
  | {
      type: 'action'
      id: string
      title: string
      keywords?: string[]
      icon?: string
      roles?: AppRole[]
      run: (ctx: CommandContext) => Promise<void> | void
    }
