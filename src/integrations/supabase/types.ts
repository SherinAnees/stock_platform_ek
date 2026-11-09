export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      article_stock_by_theme: {
        Row: {
          article_id: string
          created_at: string
          current_qty: number
          id: string
          min_qty: number
          reorder_ordered_at: string | null
          reorder_qty: number
          reorder_status: string
          reserved_qty: number
          stock_center_id: string
          theme_id: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          article_id: string
          created_at?: string
          current_qty?: number
          id?: string
          min_qty?: number
          reorder_ordered_at?: string | null
          reorder_qty?: number
          reorder_status?: string
          reserved_qty?: number
          stock_center_id: string
          theme_id: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          article_id?: string
          created_at?: string
          current_qty?: number
          id?: string
          min_qty?: number
          reorder_ordered_at?: string | null
          reorder_qty?: number
          reorder_status?: string
          reserved_qty?: number
          stock_center_id?: string
          theme_id?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_stock_by_theme_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_stock_by_theme_stock_center_id_fkey"
            columns: ["stock_center_id"]
            isOneToOne: false
            referencedRelation: "stock_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_stock_by_theme_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "color_themes"
            referencedColumns: ["id"]
          },
        ]
      }
      articles: {
        Row: {
          ai_detected_config: Json | null
          category: string | null
          code: string
          created_at: string
          current_qty: number
          depth_mm: number | null
          description: string | null
          dimension_unit: string
          has_3d_model: boolean
          height_mm: number | null
          id: string
          illustration_status: Database["public"]["Enums"]["illustration_status"]
          image_url: string | null
          is_active: boolean
          min_qty: number
          model_config: Json | null
          model_created_at: string | null
          model_created_by: string | null
          model_source: string | null
          name: string
          reference_image_url: string | null
          reorder_ordered_at: string | null
          reorder_qty: number
          reorder_status: string
          reserved_qty: number
          supplier: string | null
          unit: string
          unit_price: number
          unit_type: string | null
          updated_at: string
          volume_m3: number | null
          width_mm: number | null
        }
        Insert: {
          ai_detected_config?: Json | null
          category?: string | null
          code: string
          created_at?: string
          current_qty?: number
          depth_mm?: number | null
          description?: string | null
          dimension_unit?: string
          has_3d_model?: boolean
          height_mm?: number | null
          id?: string
          illustration_status?: Database["public"]["Enums"]["illustration_status"]
          image_url?: string | null
          is_active?: boolean
          min_qty?: number
          model_config?: Json | null
          model_created_at?: string | null
          model_created_by?: string | null
          model_source?: string | null
          name: string
          reference_image_url?: string | null
          reorder_ordered_at?: string | null
          reorder_qty?: number
          reorder_status?: string
          reserved_qty?: number
          supplier?: string | null
          unit?: string
          unit_price?: number
          unit_type?: string | null
          updated_at?: string
          volume_m3?: number | null
          width_mm?: number | null
        }
        Update: {
          ai_detected_config?: Json | null
          category?: string | null
          code?: string
          created_at?: string
          current_qty?: number
          depth_mm?: number | null
          description?: string | null
          dimension_unit?: string
          has_3d_model?: boolean
          height_mm?: number | null
          id?: string
          illustration_status?: Database["public"]["Enums"]["illustration_status"]
          image_url?: string | null
          is_active?: boolean
          min_qty?: number
          model_config?: Json | null
          model_created_at?: string | null
          model_created_by?: string | null
          model_source?: string | null
          name?: string
          reference_image_url?: string | null
          reorder_ordered_at?: string | null
          reorder_qty?: number
          reorder_status?: string
          reserved_qty?: number
          supplier?: string | null
          unit?: string
          unit_price?: number
          unit_type?: string | null
          updated_at?: string
          volume_m3?: number | null
          width_mm?: number | null
        }
        Relationships: []
      }
      color_themes: {
        Row: {
          carcass_code: string | null
          code: string
          created_at: string
          description: string | null
          front_code: string | null
          hex_color: string | null
          id: string
          is_active: boolean
          name: string
          range: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          carcass_code?: string | null
          code: string
          created_at?: string
          description?: string | null
          front_code?: string | null
          hex_color?: string | null
          id?: string
          is_active?: boolean
          name: string
          range?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          carcass_code?: string | null
          code?: string
          created_at?: string
          description?: string | null
          front_code?: string | null
          hex_color?: string | null
          id?: string
          is_active?: boolean
          name?: string
          range?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      kitchen_designs: {
        Row: {
          base_unit_theme_id: string | null
          bom: Json | null
          created_at: string
          created_by: string
          expired_at: string | null
          id: string
          intake: Json | null
          name: string | null
          partner_id: string | null
          placed: Json | null
          reserved_at: string | null
          reserved_lines: Json | null
          stock_center_id: string | null
          tall_unit_theme_id: string | null
          updated_at: string
          wall_unit_theme_id: string | null
        }
        Insert: {
          base_unit_theme_id?: string | null
          bom?: Json | null
          created_at?: string
          created_by: string
          expired_at?: string | null
          id?: string
          intake?: Json | null
          name?: string | null
          partner_id?: string | null
          placed?: Json | null
          reserved_at?: string | null
          reserved_lines?: Json | null
          stock_center_id?: string | null
          tall_unit_theme_id?: string | null
          updated_at?: string
          wall_unit_theme_id?: string | null
        }
        Update: {
          base_unit_theme_id?: string | null
          bom?: Json | null
          created_at?: string
          created_by?: string
          expired_at?: string | null
          id?: string
          intake?: Json | null
          name?: string | null
          partner_id?: string | null
          placed?: Json | null
          reserved_at?: string | null
          reserved_lines?: Json | null
          stock_center_id?: string | null
          tall_unit_theme_id?: string | null
          updated_at?: string
          wall_unit_theme_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_designs_base_unit_theme_id_fkey"
            columns: ["base_unit_theme_id"]
            isOneToOne: false
            referencedRelation: "color_themes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_designs_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_designs_stock_center_id_fkey"
            columns: ["stock_center_id"]
            isOneToOne: false
            referencedRelation: "stock_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_designs_tall_unit_theme_id_fkey"
            columns: ["tall_unit_theme_id"]
            isOneToOne: false
            referencedRelation: "color_themes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_designs_wall_unit_theme_id_fkey"
            columns: ["wall_unit_theme_id"]
            isOneToOne: false
            referencedRelation: "color_themes"
            referencedColumns: ["id"]
          },
        ]
      }
      order_lines: {
        Row: {
          article_id: string
          id: string
          line_total: number
          order_id: string
          qty: number
          theme_id: string | null
          unit_price: number
        }
        Insert: {
          article_id: string
          id?: string
          line_total?: number
          order_id: string
          qty: number
          theme_id?: string | null
          unit_price?: number
        }
        Update: {
          article_id?: string
          id?: string
          line_total?: number
          order_id?: string
          qty?: number
          theme_id?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_lines_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_near_expiry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "color_themes"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          auto_cancelled: boolean
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          client_name: string | null
          code: string
          created_at: string
          created_by: string | null
          delivery_notes: string | null
          design_id: string | null
          fulfilled_at: string | null
          id: string
          last_status_changed_at: string
          notes: string | null
          partner_id: string | null
          region_id: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["order_status"]
          stock_center_id: string | null
          total: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          auto_cancelled?: boolean
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          client_name?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          delivery_notes?: string | null
          design_id?: string | null
          fulfilled_at?: string | null
          id?: string
          last_status_changed_at?: string
          notes?: string | null
          partner_id?: string | null
          region_id?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          stock_center_id?: string | null
          total?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          auto_cancelled?: boolean
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          client_name?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          delivery_notes?: string | null
          design_id?: string | null
          fulfilled_at?: string | null
          id?: string
          last_status_changed_at?: string
          notes?: string | null
          partner_id?: string | null
          region_id?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          stock_center_id?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "kitchen_designs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_stock_center_id_fkey"
            columns: ["stock_center_id"]
            isOneToOne: false
            referencedRelation: "stock_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          account_no: string | null
          address: string | null
          city: string | null
          company_name: string
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          nolte_iam: string | null
          phone: string | null
          region_id: string | null
          short_key: string | null
          state: string | null
          stock_center_id: string | null
          territory: string | null
          zone: string | null
        }
        Insert: {
          account_no?: string | null
          address?: string | null
          city?: string | null
          company_name: string
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nolte_iam?: string | null
          phone?: string | null
          region_id?: string | null
          short_key?: string | null
          state?: string | null
          stock_center_id?: string | null
          territory?: string | null
          zone?: string | null
        }
        Update: {
          account_no?: string | null
          address?: string | null
          city?: string | null
          company_name?: string
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nolte_iam?: string | null
          phone?: string | null
          region_id?: string | null
          short_key?: string | null
          state?: string | null
          stock_center_id?: string | null
          territory?: string | null
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partners_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partners_stock_center_id_fkey"
            columns: ["stock_center_id"]
            isOneToOne: false
            referencedRelation: "stock_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_matrix: {
        Row: {
          id: string
          module_key: string
          module_label: string
          module_sort_order: number
          permission: Database["public"]["Enums"]["permission_level"]
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          module_key: string
          module_label: string
          module_sort_order?: number
          permission?: Database["public"]["Enums"]["permission_level"]
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          module_key?: string
          module_label?: string
          module_sort_order?: number
          permission?: Database["public"]["Enums"]["permission_level"]
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      price_change_log: {
        Row: {
          article_id: string
          change_source: Database["public"]["Enums"]["price_change_source"]
          changed_at: string
          changed_by: string | null
          id: string
          new_price: number
          old_price: number
          stock_center_id: string | null
        }
        Insert: {
          article_id: string
          change_source?: Database["public"]["Enums"]["price_change_source"]
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_price: number
          old_price: number
          stock_center_id?: string | null
        }
        Update: {
          article_id?: string
          change_source?: Database["public"]["Enums"]["price_change_source"]
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_price?: number
          old_price?: number
          stock_center_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_change_log_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_change_log_stock_center_id_fkey"
            columns: ["stock_center_id"]
            isOneToOne: false
            referencedRelation: "stock_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string | null
          email: string | null
          first_name: string | null
          full_name: string | null
          id: string
          invitation_status: string
          invited_at: string | null
          is_active: boolean
          job_title: string | null
          last_login_at: string | null
          last_name: string | null
          partner_id: string | null
          phone: string | null
          stock_center_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          id: string
          invitation_status?: string
          invited_at?: string | null
          is_active?: boolean
          job_title?: string | null
          last_login_at?: string | null
          last_name?: string | null
          partner_id?: string | null
          phone?: string | null
          stock_center_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          invitation_status?: string
          invited_at?: string | null
          is_active?: boolean
          job_title?: string | null
          last_login_at?: string | null
          last_name?: string | null
          partner_id?: string | null
          phone?: string | null
          stock_center_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_stock_center_id_fkey"
            columns: ["stock_center_id"]
            isOneToOne: false
            referencedRelation: "stock_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      regions: {
        Row: {
          country: string | null
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          country?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      reorder_batch_lines: {
        Row: {
          arrived_at: string | null
          article_id: string
          batch_id: string
          created_at: string
          id: string
          qty: number
          theme_id: string | null
        }
        Insert: {
          arrived_at?: string | null
          article_id: string
          batch_id: string
          created_at?: string
          id?: string
          qty: number
          theme_id?: string | null
        }
        Update: {
          arrived_at?: string | null
          article_id?: string
          batch_id?: string
          created_at?: string
          id?: string
          qty?: number
          theme_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reorder_batch_lines_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reorder_batch_lines_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "reorder_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reorder_batch_lines_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "color_themes"
            referencedColumns: ["id"]
          },
        ]
      }
      reorder_batches: {
        Row: {
          code: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          status: string
        }
        Insert: {
          code: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          status?: string
        }
        Update: {
          code?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          status?: string
        }
        Relationships: []
      }
      stock_centers: {
        Row: {
          address: string | null
          city: string | null
          code: string
          contact_email: string | null
          contact_phone: string | null
          country: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          code: string
          contact_email?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string
          contact_email?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          article_id: string
          created_at: string
          created_by: string | null
          delta: number
          id: string
          notes: string | null
          order_id: string | null
          reason: Database["public"]["Enums"]["movement_reason"]
          stock_center_id: string | null
          theme_id: string | null
          unit_price: number
        }
        Insert: {
          article_id: string
          created_at?: string
          created_by?: string | null
          delta: number
          id?: string
          notes?: string | null
          order_id?: string | null
          reason: Database["public"]["Enums"]["movement_reason"]
          stock_center_id?: string | null
          theme_id?: string | null
          unit_price?: number
        }
        Update: {
          article_id?: string
          created_at?: string
          created_by?: string | null
          delta?: number
          id?: string
          notes?: string | null
          order_id?: string | null
          reason?: Database["public"]["Enums"]["movement_reason"]
          stock_center_id?: string | null
          theme_id?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_stock_center_id_fkey"
            columns: ["stock_center_id"]
            isOneToOne: false
            referencedRelation: "stock_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "color_themes"
            referencedColumns: ["id"]
          },
        ]
      }
      theme_finishes: {
        Row: {
          carcase_code: string | null
          created_at: string
          door_image_url: string | null
          front_code: string | null
          id: string
          is_active: boolean
          material_description: string | null
          range_name: string | null
          sort_order: number
          style_badge: string | null
          theme_id: string
          unit_category: Database["public"]["Enums"]["finish_unit_category"]
          updated_at: string
        }
        Insert: {
          carcase_code?: string | null
          created_at?: string
          door_image_url?: string | null
          front_code?: string | null
          id?: string
          is_active?: boolean
          material_description?: string | null
          range_name?: string | null
          sort_order?: number
          style_badge?: string | null
          theme_id: string
          unit_category: Database["public"]["Enums"]["finish_unit_category"]
          updated_at?: string
        }
        Update: {
          carcase_code?: string | null
          created_at?: string
          door_image_url?: string | null
          front_code?: string | null
          id?: string
          is_active?: boolean
          material_description?: string | null
          range_name?: string | null
          sort_order?: number
          style_badge?: string | null
          theme_id?: string
          unit_category?: Database["public"]["Enums"]["finish_unit_category"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "theme_finishes_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "color_themes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      orders_near_expiry: {
        Row: {
          code: string | null
          expires_at: string | null
          hours_remaining: number | null
          id: string | null
          last_status_changed_at: string | null
          partner_id: string | null
          region_id: string | null
          status: Database["public"]["Enums"]["order_status"] | null
        }
        Insert: {
          code?: string | null
          expires_at?: never
          hours_remaining?: never
          id?: string | null
          last_status_changed_at?: string | null
          partner_id?: string | null
          region_id?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
        }
        Update: {
          code?: string | null
          expires_at?: never
          hours_remaining?: never
          id?: string | null
          last_status_changed_at?: string | null
          partner_id?: string | null
          region_id?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_finalize_invited_user: {
        Args: {
          _avatar_url: string
          _email: string
          _first_name: string
          _job_title: string
          _last_name: string
          _phone: string
          _role: Database["public"]["Enums"]["app_role"]
          _stock_center_id: string
          _user_id: string
        }
        Returns: undefined
      }
      admin_toggle_user_active: {
        Args: { _active: boolean; _user_id: string }
        Returns: undefined
      }
      admin_update_user: {
        Args: {
          _avatar_url: string
          _first_name: string
          _job_title: string
          _last_name: string
          _phone: string
          _role: Database["public"]["Enums"]["app_role"]
          _stock_center_id: string
          _user_id: string
        }
        Returns: undefined
      }
      approve_order: { Args: { _order_id: string }; Returns: Json }
      auto_recall_orders: { Args: { _days?: number }; Returns: Json }
      bulk_set_stock:
        | { Args: { _items: Json }; Returns: Json }
        | { Args: { _items: Json; _stock_center_id?: string }; Returns: Json }
      bulk_update_prices:
        | {
            Args: {
              _items: Json
              _source?: Database["public"]["Enums"]["price_change_source"]
            }
            Returns: Json
          }
        | {
            Args: {
              _items: Json
              _source?: Database["public"]["Enums"]["price_change_source"]
              _stock_center_id?: string
            }
            Returns: Json
          }
      bulk_zero_stock:
        | { Args: { _pairs: Json }; Returns: Json }
        | { Args: { _pairs: Json; _stock_center_id?: string }; Returns: Json }
      can_manage_user: {
        Args: {
          _target_role?: Database["public"]["Enums"]["app_role"]
          _target_user_id: string
        }
        Returns: boolean
      }
      cancel_order: {
        Args: { _order_id: string; _reason: string }
        Returns: undefined
      }
      delete_color_theme: { Args: { _theme_id: string }; Returns: Json }
      effective_stock_center_id: {
        Args: { _override?: string }
        Returns: string
      }
      fulfill_order: { Args: { _order_id: string }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_designer_order_processor: { Args: never; Returns: boolean }
      is_master_admin: { Args: never; Returns: boolean }
      is_partner: { Args: never; Returns: boolean }
      is_stock_center_admin: { Args: never; Returns: boolean }
      is_stockkeeper: { Args: never; Returns: boolean }
      is_store_keeper: { Args: never; Returns: boolean }
      mark_reorder_arrived:
        | {
            Args: { _article_id: string; _theme_id: string }
            Returns: undefined
          }
        | {
            Args: {
              _article_id: string
              _stock_center_id?: string
              _theme_id: string
            }
            Returns: undefined
          }
      my_partner_id: { Args: never; Returns: string }
      my_stock_center_id: { Args: never; Returns: string }
      place_reorders:
        | { Args: { _items: Json }; Returns: string }
        | { Args: { _items: Json; _stock_center_id?: string }; Returns: string }
      record_login: { Args: never; Returns: undefined }
      reject_order: {
        Args: { _order_id: string; _reason: string }
        Returns: undefined
      }
      release_design_draft: { Args: { _design_id: string }; Returns: undefined }
      reserve_design_draft: {
        Args: { _design_id: string; _lines: Json }
        Returns: undefined
      }
      submit_order: { Args: { _order_id: string }; Returns: undefined }
      theme_delete_precheck: { Args: { _theme_id: string }; Returns: Json }
    }
    Enums: {
      app_role:
        | "stock_center_admin"
        | "store_keeper"
        | "designer_order_processor"
        | "master_admin"
      finish_unit_category: "base" | "tall" | "wall"
      illustration_status: "pending" | "no_illustration" | "model_ready"
      movement_reason:
        | "receive"
        | "adjust"
        | "order_fulfilled"
        | "order_reversal"
        | "opening_stock"
        | "stock_received"
        | "reorder_placed"
        | "reorder_received"
      order_status:
        | "draft"
        | "submitted"
        | "approved"
        | "fulfilled"
        | "rejected"
        | "cancelled"
        | "auto_cancelled"
      permission_level: "no_permission" | "read_only" | "modify"
      price_change_source: "bulk_edit" | "excel_upload" | "manual_edit"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "stock_center_admin",
        "store_keeper",
        "designer_order_processor",
        "master_admin",
      ],
      finish_unit_category: ["base", "tall", "wall"],
      illustration_status: ["pending", "no_illustration", "model_ready"],
      movement_reason: [
        "receive",
        "adjust",
        "order_fulfilled",
        "order_reversal",
        "opening_stock",
        "stock_received",
        "reorder_placed",
        "reorder_received",
      ],
      order_status: [
        "draft",
        "submitted",
        "approved",
        "fulfilled",
        "rejected",
        "cancelled",
        "auto_cancelled",
      ],
      permission_level: ["no_permission", "read_only", "modify"],
      price_change_source: ["bulk_edit", "excel_upload", "manual_edit"],
    },
  },
} as const
