import { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../config/supabase';

export abstract class BaseRepository {
  protected readonly db: SupabaseClient;
  protected abstract readonly table: string;

  constructor(client: SupabaseClient = supabaseAdmin) {
    this.db = client;
  }

  protected from() {
    return this.db.from(this.table);
  }
}
