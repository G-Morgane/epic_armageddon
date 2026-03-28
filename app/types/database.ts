export type Faction = 'imperium' | 'chaos' | 'xenos'
export type ArmyStatus = 'official' | 'beta' | 'experimental' | '30k'

export interface Army {
  id: string
  name: string
  faction: Faction
  cover_image: string | null
  status: ArmyStatus
  quote: string | null
  quote_author: string | null
  created_at: string
}

export interface ArmyVersion {
  id: string
  army_id: string
  version: string
  pdf_url: string
  changelog: string | null
  published_at: string
  is_current: boolean
}

export interface ArmyTag {
  id: string
  name: string
  faction: Faction
  position: number
  created_at: string
}

export interface ArmyTagAssignment {
  army_id: string
  tag_id: string
}

export interface GameEvent {
  id: string
  title: string
  description: string | null
  external_link: string | null
  address: string | null
  contact: string | null
  event_date: string
  event_end_date: string | null
  created_at: string
}

export interface Database {
  public: {
    Tables: {
      armies: {
        Row: Army
        Insert: Omit<Army, 'id' | 'created_at'>
        Update: Partial<Omit<Army, 'id' | 'created_at'>>
      }
      army_versions: {
        Row: ArmyVersion
        Insert: Omit<ArmyVersion, 'id'>
        Update: Partial<Omit<ArmyVersion, 'id'>>
      }
      army_tags: {
        Row: ArmyTag
        Insert: Omit<ArmyTag, 'id' | 'created_at'>
        Update: Partial<Omit<ArmyTag, 'id' | 'created_at'>>
      }
      army_tag_assignments: {
        Row: ArmyTagAssignment
        Insert: ArmyTagAssignment
        Update: Partial<ArmyTagAssignment>
      }
    }
  }
}
