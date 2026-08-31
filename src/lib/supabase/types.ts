export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      change_logs: {
        Row: {
          campo: string;
          fecha: string;
          id: string;
          modificado_por_id: string;
          registro_id: string;
          tabla: string;
          valor_anterior: string | null;
          valor_nuevo: string | null;
        };
        Insert: {
          campo: string;
          fecha?: string;
          id?: string;
          modificado_por_id: string;
          registro_id: string;
          tabla: string;
          valor_anterior?: string | null;
          valor_nuevo?: string | null;
        };
        Update: {
          campo?: string;
          fecha?: string;
          id?: string;
          modificado_por_id?: string;
          registro_id?: string;
          tabla?: string;
          valor_anterior?: string | null;
          valor_nuevo?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "change_logs_modificado_por_id_fkey";
            columns: ["modificado_por_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ];
      };
      clientes: {
        Row: {
          creado_en: string;
          digito_verificacion: string | null;
          direccion: string | null;
          email: string | null;
          id: string;
          last_modified: string;
          naturaleza: string | null;
          nit: string;
          nombre_cliente: string;
          nombre_prestador: string | null;
          nombre_representante_legal: string | null;
          sync_status: string;
          telefono: string | null;
        };
        Insert: {
          creado_en?: string;
          digito_verificacion?: string | null;
          direccion?: string | null;
          email?: string | null;
          id?: string;
          last_modified?: string;
          naturaleza?: string | null;
          nit: string;
          nombre_cliente: string;
          nombre_prestador?: string | null;
          nombre_representante_legal?: string | null;
          sync_status?: string;
          telefono?: string | null;
        };
        Update: {
          creado_en?: string;
          digito_verificacion?: string | null;
          direccion?: string | null;
          email?: string | null;
          id?: string;
          last_modified?: string;
          naturaleza?: string | null;
          nit?: string;
          nombre_cliente?: string;
          nombre_prestador?: string | null;
          nombre_representante_legal?: string | null;
          sync_status?: string;
          telefono?: string | null;
        };
        Relationships: [];
      };
      colimadores: {
        Row: {
          creado_en: string;
          equipo_id: string;
          id: string;
          last_modified: string;
          marca: string | null;
          modelo: string | null;
          numero_serie: string | null;
          sync_status: string;
        };
        Insert: {
          creado_en?: string;
          equipo_id: string;
          id?: string;
          last_modified?: string;
          marca?: string | null;
          modelo?: string | null;
          numero_serie?: string | null;
          sync_status?: string;
        };
        Update: {
          creado_en?: string;
          equipo_id?: string;
          id?: string;
          last_modified?: string;
          marca?: string | null;
          modelo?: string | null;
          numero_serie?: string | null;
          sync_status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "colimadores_equipo_id_fkey";
            columns: ["equipo_id"];
            isOneToOne: false;
            referencedRelation: "equipos";
            referencedColumns: ["id"];
          },
        ];
      };
      contactos: {
        Row: {
          cargo: string | null;
          cedula: string | null;
          cliente_id: string;
          creado_en: string;
          email: string | null;
          id: string;
          last_modified: string;
          nombre: string;
          para_programar: boolean;
          sync_status: string;
          telefono: string | null;
        };
        Insert: {
          cargo?: string | null;
          cedula?: string | null;
          cliente_id: string;
          creado_en?: string;
          email?: string | null;
          id?: string;
          last_modified?: string;
          nombre: string;
          para_programar?: boolean;
          sync_status?: string;
          telefono?: string | null;
        };
        Update: {
          cargo?: string | null;
          cedula?: string | null;
          cliente_id?: string;
          creado_en?: string;
          email?: string | null;
          id?: string;
          last_modified?: string;
          nombre?: string;
          para_programar?: boolean;
          sync_status?: string;
          telefono?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "contactos_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
        ];
      };
      conv_bajo_contraste: {
        Row: {
          creado_en: string;
          id: string;
          last_modified: string;
          notas: string | null;
          sync_status: string;
          umbral_detectado: number | null;
          visita_id: string;
        };
        Insert: {
          creado_en?: string;
          id?: string;
          last_modified?: string;
          notas?: string | null;
          sync_status?: string;
          umbral_detectado?: number | null;
          visita_id: string;
        };
        Update: {
          creado_en?: string;
          id?: string;
          last_modified?: string;
          notas?: string | null;
          sync_status?: string;
          umbral_detectado?: number | null;
          visita_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conv_bajo_contraste_visita_id_fkey";
            columns: ["visita_id"];
            isOneToOne: true;
            referencedRelation: "visitas";
            referencedColumns: ["id"];
          },
        ];
      };
      conv_cae_mediciones: {
        Row: {
          creado_en: string;
          filtro: string | null;
          id: string;
          kerma_mgy: number | null;
          kvp: number | null;
          last_modified: string;
          mas_resultado: number | null;
          notas: string | null;
          prueba_codigo: string;
          sync_status: string;
          valor_base: number | null;
          visita_id: string;
        };
        Insert: {
          creado_en?: string;
          filtro?: string | null;
          id?: string;
          kerma_mgy?: number | null;
          kvp?: number | null;
          last_modified?: string;
          mas_resultado?: number | null;
          notas?: string | null;
          prueba_codigo: string;
          sync_status?: string;
          valor_base?: number | null;
          visita_id: string;
        };
        Update: {
          creado_en?: string;
          filtro?: string | null;
          id?: string;
          kerma_mgy?: number | null;
          kvp?: number | null;
          last_modified?: string;
          mas_resultado?: number | null;
          notas?: string | null;
          prueba_codigo?: string;
          sync_status?: string;
          valor_base?: number | null;
          visita_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conv_cae_mediciones_visita_id_fkey";
            columns: ["visita_id"];
            isOneToOne: false;
            referencedRelation: "visitas";
            referencedColumns: ["id"];
          },
        ];
      };
      conv_cae_setup: {
        Row: {
          creado_en: string;
          id: string;
          last_modified: string;
          notas: string | null;
          phantom: string | null;
          posicion: string | null;
          sync_status: string;
          visita_id: string;
        };
        Insert: {
          creado_en?: string;
          id?: string;
          last_modified?: string;
          notas?: string | null;
          phantom?: string | null;
          posicion?: string | null;
          sync_status?: string;
          visita_id: string;
        };
        Update: {
          creado_en?: string;
          id?: string;
          last_modified?: string;
          notas?: string | null;
          phantom?: string | null;
          posicion?: string | null;
          sync_status?: string;
          visita_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conv_cae_setup_visita_id_fkey";
            columns: ["visita_id"];
            isOneToOne: true;
            referencedRelation: "visitas";
            referencedColumns: ["id"];
          },
        ];
      };
      conv_cassette_inspeccion: {
        Row: {
          conformes: number | null;
          creado_en: string;
          id: string;
          last_modified: string;
          no_conformes: number | null;
          observaciones: string | null;
          sync_status: string;
          total: number | null;
          visita_id: string;
        };
        Insert: {
          conformes?: number | null;
          creado_en?: string;
          id?: string;
          last_modified?: string;
          no_conformes?: number | null;
          observaciones?: string | null;
          sync_status?: string;
          total?: number | null;
          visita_id: string;
        };
        Update: {
          conformes?: number | null;
          creado_en?: string;
          id?: string;
          last_modified?: string;
          no_conformes?: number | null;
          observaciones?: string | null;
          sync_status?: string;
          total?: number | null;
          visita_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conv_cassette_inspeccion_visita_id_fkey";
            columns: ["visita_id"];
            isOneToOne: true;
            referencedRelation: "visitas";
            referencedColumns: ["id"];
          },
        ];
      };
      conv_colimacion: {
        Row: {
          campo_luz_cm: number | null;
          campo_rx_cm: number | null;
          creado_en: string;
          diferencia_cm: number | null;
          id: string;
          last_modified: string;
          notas: string | null;
          perpendiculares: Json | null;
          sync_status: string;
          visita_id: string;
        };
        Insert: {
          campo_luz_cm?: number | null;
          campo_rx_cm?: number | null;
          creado_en?: string;
          diferencia_cm?: number | null;
          id?: string;
          last_modified?: string;
          notas?: string | null;
          perpendiculares?: Json | null;
          sync_status?: string;
          visita_id: string;
        };
        Update: {
          campo_luz_cm?: number | null;
          campo_rx_cm?: number | null;
          creado_en?: string;
          diferencia_cm?: number | null;
          id?: string;
          last_modified?: string;
          notas?: string | null;
          perpendiculares?: Json | null;
          sync_status?: string;
          visita_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conv_colimacion_visita_id_fkey";
            columns: ["visita_id"];
            isOneToOne: true;
            referencedRelation: "visitas";
            referencedColumns: ["id"];
          },
        ];
      };
      conv_ddi_mediciones: {
        Row: {
          creado_en: string;
          ddi: number | null;
          ei: number | null;
          id: string;
          kv: number | null;
          last_modified: string;
          mas: number | null;
          notas: string | null;
          numero: number;
          prueba_codigo: string;
          sync_status: string;
          visita_id: string;
        };
        Insert: {
          creado_en?: string;
          ddi?: number | null;
          ei?: number | null;
          id?: string;
          kv?: number | null;
          last_modified?: string;
          mas?: number | null;
          notas?: string | null;
          numero: number;
          prueba_codigo: string;
          sync_status?: string;
          visita_id: string;
        };
        Update: {
          creado_en?: string;
          ddi?: number | null;
          ei?: number | null;
          id?: string;
          kv?: number | null;
          last_modified?: string;
          mas?: number | null;
          notas?: string | null;
          numero?: number;
          prueba_codigo?: string;
          sync_status?: string;
          visita_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conv_ddi_mediciones_visita_id_fkey";
            columns: ["visita_id"];
            isOneToOne: false;
            referencedRelation: "visitas";
            referencedColumns: ["id"];
          },
        ];
      };
      conv_elementos_proteccion: {
        Row: {
          cantidad: number | null;
          creado_en: string;
          descripcion: string;
          estado: string | null;
          id: string;
          last_modified: string;
          observacion: string | null;
          sync_status: string;
          visita_id: string;
        };
        Insert: {
          cantidad?: number | null;
          creado_en?: string;
          descripcion: string;
          estado?: string | null;
          id?: string;
          last_modified?: string;
          observacion?: string | null;
          sync_status?: string;
          visita_id: string;
        };
        Update: {
          cantidad?: number | null;
          creado_en?: string;
          descripcion?: string;
          estado?: string | null;
          id?: string;
          last_modified?: string;
          observacion?: string | null;
          sync_status?: string;
          visita_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conv_elementos_proteccion_visita_id_fkey";
            columns: ["visita_id"];
            isOneToOne: false;
            referencedRelation: "visitas";
            referencedColumns: ["id"];
          },
        ];
      };
      conv_evidencias: {
        Row: {
          creado_en: string;
          descripcion: string | null;
          id: string;
          last_modified: string;
          orden: number;
          prueba_codigo: string;
          storage_path: string | null;
          sync_status: string;
          url_storage: string | null;
          visita_id: string;
        };
        Insert: {
          creado_en?: string;
          descripcion?: string | null;
          id?: string;
          last_modified?: string;
          orden?: number;
          prueba_codigo: string;
          storage_path?: string | null;
          sync_status?: string;
          url_storage?: string | null;
          visita_id: string;
        };
        Update: {
          creado_en?: string;
          descripcion?: string | null;
          id?: string;
          last_modified?: string;
          orden?: number;
          prueba_codigo?: string;
          storage_path?: string | null;
          sync_status?: string;
          url_storage?: string | null;
          visita_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conv_evidencias_visita_id_fkey";
            columns: ["visita_id"];
            isOneToOne: false;
            referencedRelation: "visitas";
            referencedColumns: ["id"];
          },
        ];
      };
      conv_informe_secciones: {
        Row: {
          creado_en: string;
          id: string;
          last_modified: string;
          secciones: Json;
          sync_status: string;
          visita_id: string;
        };
        Insert: {
          creado_en?: string;
          id?: string;
          last_modified?: string;
          secciones?: Json;
          sync_status?: string;
          visita_id: string;
        };
        Update: {
          creado_en?: string;
          id?: string;
          last_modified?: string;
          secciones?: Json;
          sync_status?: string;
          visita_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conv_informe_secciones_visita_id_fkey";
            columns: ["visita_id"];
            isOneToOne: true;
            referencedRelation: "visitas";
            referencedColumns: ["id"];
          },
        ];
      };
      conv_inspeccion_items: {
        Row: {
          categoria: string | null;
          creado_en: string;
          estado: string | null;
          id: string;
          item: string;
          last_modified: string;
          observacion: string | null;
          sync_status: string;
          visita_id: string;
        };
        Insert: {
          categoria?: string | null;
          creado_en?: string;
          estado?: string | null;
          id?: string;
          item: string;
          last_modified?: string;
          observacion?: string | null;
          sync_status?: string;
          visita_id: string;
        };
        Update: {
          categoria?: string | null;
          creado_en?: string;
          estado?: string | null;
          id?: string;
          item?: string;
          last_modified?: string;
          observacion?: string | null;
          sync_status?: string;
          visita_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conv_inspeccion_items_visita_id_fkey";
            columns: ["visita_id"];
            isOneToOne: false;
            referencedRelation: "visitas";
            referencedColumns: ["id"];
          },
        ];
      };
      conv_levantamiento_setup: {
        Row: {
          calibrado_en: string | null;
          creado_en: string;
          humedad_pct: number | null;
          id: string;
          instrumento: string | null;
          last_modified: string;
          notas: string | null;
          numero_serie: string | null;
          presion_hpa: number | null;
          sync_status: string;
          temperatura_c: number | null;
          visita_id: string;
        };
        Insert: {
          calibrado_en?: string | null;
          creado_en?: string;
          humedad_pct?: number | null;
          id?: string;
          instrumento?: string | null;
          last_modified?: string;
          notas?: string | null;
          numero_serie?: string | null;
          presion_hpa?: number | null;
          sync_status?: string;
          temperatura_c?: number | null;
          visita_id: string;
        };
        Update: {
          calibrado_en?: string | null;
          creado_en?: string;
          humedad_pct?: number | null;
          id?: string;
          instrumento?: string | null;
          last_modified?: string;
          notas?: string | null;
          numero_serie?: string | null;
          presion_hpa?: number | null;
          sync_status?: string;
          temperatura_c?: number | null;
          visita_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conv_levantamiento_setup_visita_id_fkey";
            columns: ["visita_id"];
            isOneToOne: true;
            referencedRelation: "visitas";
            referencedColumns: ["id"];
          },
        ];
      };
      conv_mediciones: {
        Row: {
          concepto: string | null;
          creado_en: string;
          dosis_anual_msv: number | null;
          factor_ocupacion: string | null;
          id: string;
          last_modified: string;
          observacion: string | null;
          punto_numero: number;
          sync_status: string;
          tasa_dosis_msv_h: number | null;
          tipo_area: string | null;
          ubicacion_descripcion: string;
          visita_id: string;
        };
        Insert: {
          concepto?: string | null;
          creado_en?: string;
          dosis_anual_msv?: number | null;
          factor_ocupacion?: string | null;
          id?: string;
          last_modified?: string;
          observacion?: string | null;
          punto_numero: number;
          sync_status?: string;
          tasa_dosis_msv_h?: number | null;
          tipo_area?: string | null;
          ubicacion_descripcion: string;
          visita_id: string;
        };
        Update: {
          concepto?: string | null;
          creado_en?: string;
          dosis_anual_msv?: number | null;
          factor_ocupacion?: string | null;
          id?: string;
          last_modified?: string;
          observacion?: string | null;
          punto_numero?: number;
          sync_status?: string;
          tasa_dosis_msv_h?: number | null;
          tipo_area?: string | null;
          ubicacion_descripcion?: string;
          visita_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conv_mediciones_visita_id_fkey";
            columns: ["visita_id"];
            isOneToOne: false;
            referencedRelation: "visitas";
            referencedColumns: ["id"];
          },
        ];
      };
      conv_mtf: {
        Row: {
          creado_en: string;
          id: string;
          last_modified: string;
          notas: string | null;
          sync_status: string;
          valores_json: Json | null;
          visita_id: string;
        };
        Insert: {
          creado_en?: string;
          id?: string;
          last_modified?: string;
          notas?: string | null;
          sync_status?: string;
          valores_json?: Json | null;
          visita_id: string;
        };
        Update: {
          creado_en?: string;
          id?: string;
          last_modified?: string;
          notas?: string | null;
          sync_status?: string;
          valores_json?: Json | null;
          visita_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conv_mtf_visita_id_fkey";
            columns: ["visita_id"];
            isOneToOne: true;
            referencedRelation: "visitas";
            referencedColumns: ["id"];
          },
        ];
      };
      conv_raysafe_mediciones: {
        Row: {
          creado_en: string;
          ddi: number | null;
          dosis_base_mgy: number | null;
          ei: number | null;
          id: string;
          kerma_mgy: number | null;
          kv: number | null;
          last_modified: string;
          mas: number | null;
          notas: string | null;
          numero: number;
          sync_status: string;
          tipo_medicion: string;
          visita_id: string;
        };
        Insert: {
          creado_en?: string;
          ddi?: number | null;
          dosis_base_mgy?: number | null;
          ei?: number | null;
          id?: string;
          kerma_mgy?: number | null;
          kv?: number | null;
          last_modified?: string;
          mas?: number | null;
          notas?: string | null;
          numero: number;
          sync_status?: string;
          tipo_medicion: string;
          visita_id: string;
        };
        Update: {
          creado_en?: string;
          ddi?: number | null;
          dosis_base_mgy?: number | null;
          ei?: number | null;
          id?: string;
          kerma_mgy?: number | null;
          kv?: number | null;
          last_modified?: string;
          mas?: number | null;
          notas?: string | null;
          numero?: number;
          sync_status?: string;
          tipo_medicion?: string;
          visita_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conv_raysafe_mediciones_visita_id_fkey";
            columns: ["visita_id"];
            isOneToOne: false;
            referencedRelation: "visitas";
            referencedColumns: ["id"];
          },
        ];
      };
      conv_raysafe_setup: {
        Row: {
          creado_en: string;
          distancia_foco_detector_d1_cm: number | null;
          distancia_foco_detector_d2_cm: number | null;
          id: string;
          kv: number | null;
          last_modified: string;
          mas: number | null;
          modo_medicion: string | null;
          notas: string | null;
          sync_status: string;
          url_storage: string | null;
          visita_id: string;
        };
        Insert: {
          creado_en?: string;
          distancia_foco_detector_d1_cm?: number | null;
          distancia_foco_detector_d2_cm?: number | null;
          id?: string;
          kv?: number | null;
          last_modified?: string;
          mas?: number | null;
          modo_medicion?: string | null;
          notas?: string | null;
          sync_status?: string;
          url_storage?: string | null;
          visita_id: string;
        };
        Update: {
          creado_en?: string;
          distancia_foco_detector_d1_cm?: number | null;
          distancia_foco_detector_d2_cm?: number | null;
          id?: string;
          kv?: number | null;
          last_modified?: string;
          mas?: number | null;
          modo_medicion?: string | null;
          notas?: string | null;
          sync_status?: string;
          url_storage?: string | null;
          visita_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conv_raysafe_setup_visita_id_fkey";
            columns: ["visita_id"];
            isOneToOne: true;
            referencedRelation: "visitas";
            referencedColumns: ["id"];
          },
        ];
      };
      conv_resolucion: {
        Row: {
          creado_en: string;
          id: string;
          last_modified: string;
          mtf20_h: number | null;
          mtf20_v: number | null;
          mtf50_h: number | null;
          mtf50_v: number | null;
          notas: string | null;
          sync_status: string;
          visita_id: string;
        };
        Insert: {
          creado_en?: string;
          id?: string;
          last_modified?: string;
          mtf20_h?: number | null;
          mtf20_v?: number | null;
          mtf50_h?: number | null;
          mtf50_v?: number | null;
          notas?: string | null;
          sync_status?: string;
          visita_id: string;
        };
        Update: {
          creado_en?: string;
          id?: string;
          last_modified?: string;
          mtf20_h?: number | null;
          mtf20_v?: number | null;
          mtf50_h?: number | null;
          mtf50_v?: number | null;
          notas?: string | null;
          sync_status?: string;
          visita_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conv_resolucion_visita_id_fkey";
            columns: ["visita_id"];
            isOneToOne: true;
            referencedRelation: "visitas";
            referencedColumns: ["id"];
          },
        ];
      };
      conv_resultados_prueba: {
        Row: {
          concepto: string | null;
          creado_en: string;
          datos_json: Json | null;
          id: string;
          last_modified: string;
          observaciones: string | null;
          prueba_codigo: string;
          sync_status: string;
          visita_id: string;
        };
        Insert: {
          concepto?: string | null;
          creado_en?: string;
          datos_json?: Json | null;
          id?: string;
          last_modified?: string;
          observaciones?: string | null;
          prueba_codigo: string;
          sync_status?: string;
          visita_id: string;
        };
        Update: {
          concepto?: string | null;
          creado_en?: string;
          datos_json?: Json | null;
          id?: string;
          last_modified?: string;
          observaciones?: string | null;
          prueba_codigo?: string;
          sync_status?: string;
          visita_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conv_resultados_prueba_visita_id_fkey";
            columns: ["visita_id"];
            isOneToOne: false;
            referencedRelation: "visitas";
            referencedColumns: ["id"];
          },
        ];
      };
      conv_uniformidad_cr: {
        Row: {
          creado_en: string;
          desviacion: number | null;
          id: string;
          last_modified: string;
          notas: string | null;
          resultado: string | null;
          sync_status: string;
          valor_medio: number | null;
          visita_id: string;
        };
        Insert: {
          creado_en?: string;
          desviacion?: number | null;
          id?: string;
          last_modified?: string;
          notas?: string | null;
          resultado?: string | null;
          sync_status?: string;
          valor_medio?: number | null;
          visita_id: string;
        };
        Update: {
          creado_en?: string;
          desviacion?: number | null;
          id?: string;
          last_modified?: string;
          notas?: string | null;
          resultado?: string | null;
          sync_status?: string;
          valor_medio?: number | null;
          visita_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conv_uniformidad_cr_visita_id_fkey";
            columns: ["visita_id"];
            isOneToOne: true;
            referencedRelation: "visitas";
            referencedColumns: ["id"];
          },
        ];
      };
      conv_uniformidad_detector: {
        Row: {
          creado_en: string;
          id: string;
          last_modified: string;
          notas: string | null;
          sync_status: string;
          valores_json: Json | null;
          visita_id: string;
        };
        Insert: {
          creado_en?: string;
          id?: string;
          last_modified?: string;
          notas?: string | null;
          sync_status?: string;
          valores_json?: Json | null;
          visita_id: string;
        };
        Update: {
          creado_en?: string;
          id?: string;
          last_modified?: string;
          notas?: string | null;
          sync_status?: string;
          valores_json?: Json | null;
          visita_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conv_uniformidad_detector_visita_id_fkey";
            columns: ["visita_id"];
            isOneToOne: true;
            referencedRelation: "visitas";
            referencedColumns: ["id"];
          },
        ];
      };
      cotizaciones: {
        Row: {
          cliente_id: string;
          creado_en: string;
          estado: string | null;
          fecha_aceptacion: string | null;
          fecha_cotizacion: string | null;
          forma_pago: string | null;
          id: string;
          last_modified: string;
          sync_status: string;
          valor_total: number | null;
        };
        Insert: {
          cliente_id: string;
          creado_en?: string;
          estado?: string | null;
          fecha_aceptacion?: string | null;
          fecha_cotizacion?: string | null;
          forma_pago?: string | null;
          id?: string;
          last_modified?: string;
          sync_status?: string;
          valor_total?: number | null;
        };
        Update: {
          cliente_id?: string;
          creado_en?: string;
          estado?: string | null;
          fecha_aceptacion?: string | null;
          fecha_cotizacion?: string | null;
          forma_pago?: string | null;
          id?: string;
          last_modified?: string;
          sync_status?: string;
          valor_total?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "cotizaciones_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
        ];
      };
      departamentos: {
        Row: {
          codigo_dane: string;
          id: number;
          nombre: string;
        };
        Insert: {
          codigo_dane: string;
          id: number;
          nombre: string;
        };
        Update: {
          codigo_dane?: string;
          id?: number;
          nombre?: string;
        };
        Relationships: [];
      };
      elementos_proteccion: {
        Row: {
          cantidad: number | null;
          concepto: string | null;
          creado_en: string;
          descripcion: string;
          id: string;
          last_modified: string;
          observacion: string | null;
          sync_status: string;
          visita_id: string;
        };
        Insert: {
          cantidad?: number | null;
          concepto?: string | null;
          creado_en?: string;
          descripcion: string;
          id?: string;
          last_modified?: string;
          observacion?: string | null;
          sync_status?: string;
          visita_id: string;
        };
        Update: {
          cantidad?: number | null;
          concepto?: string | null;
          creado_en?: string;
          descripcion?: string;
          id?: string;
          last_modified?: string;
          observacion?: string | null;
          sync_status?: string;
          visita_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "elementos_proteccion_visita_id_fkey";
            columns: ["visita_id"];
            isOneToOne: false;
            referencedRelation: "visitas";
            referencedColumns: ["id"];
          },
        ];
      };
      equipo_identificaciones: {
        Row: {
          creado_en: string;
          deleted_at: string | null;
          equipo_id: string;
          id: string;
          last_modified: string;
          nombre: string | null;
          orden: number | null;
          ref_id: string | null;
          subtabla: string;
          sync_status: string;
          url_storage: string | null;
        };
        Insert: {
          creado_en?: string;
          deleted_at?: string | null;
          equipo_id: string;
          id?: string;
          last_modified?: string;
          nombre?: string | null;
          orden?: number | null;
          ref_id?: string | null;
          subtabla?: string;
          sync_status?: string;
          url_storage?: string | null;
        };
        Update: {
          creado_en?: string;
          deleted_at?: string | null;
          equipo_id?: string;
          id?: string;
          last_modified?: string;
          nombre?: string | null;
          orden?: number | null;
          ref_id?: string | null;
          subtabla?: string;
          sync_status?: string;
          url_storage?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "equipo_identificaciones_equipo_id_fkey";
            columns: ["equipo_id"];
            isOneToOne: false;
            referencedRelation: "equipos";
            referencedColumns: ["id"];
          },
        ];
      };
      equipo_movimientos: {
        Row: {
          creado_en: string;
          equipo_id: string;
          fecha_movimiento: string;
          id: string;
          last_modified: string;
          motivo: string | null;
          registrado_por_id: string | null;
          sync_status: string;
          ubicacion_anterior_id: string | null;
          ubicacion_nueva_id: string;
        };
        Insert: {
          creado_en?: string;
          equipo_id: string;
          fecha_movimiento: string;
          id?: string;
          last_modified?: string;
          motivo?: string | null;
          registrado_por_id?: string | null;
          sync_status?: string;
          ubicacion_anterior_id?: string | null;
          ubicacion_nueva_id: string;
        };
        Update: {
          creado_en?: string;
          equipo_id?: string;
          fecha_movimiento?: string;
          id?: string;
          last_modified?: string;
          motivo?: string | null;
          registrado_por_id?: string | null;
          sync_status?: string;
          ubicacion_anterior_id?: string | null;
          ubicacion_nueva_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "equipo_movimientos_equipo_id_fkey";
            columns: ["equipo_id"];
            isOneToOne: false;
            referencedRelation: "equipos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "equipo_movimientos_registrado_por_id_fkey";
            columns: ["registrado_por_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "equipo_movimientos_ubicacion_anterior_id_fkey";
            columns: ["ubicacion_anterior_id"];
            isOneToOne: false;
            referencedRelation: "ubicaciones_rx";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "equipo_movimientos_ubicacion_nueva_id_fkey";
            columns: ["ubicacion_nueva_id"];
            isOneToOne: false;
            referencedRelation: "ubicaciones_rx";
            referencedColumns: ["id"];
          },
        ];
      };
      equipos: {
        Row: {
          bucky: string | null;
          creado_en: string;
          distancia_foco_paciente: number | null;
          filtracion_anadida_mmal: number | null;
          filtracion_inherente_mmal: number | null;
          gen_energia_fotones_mev: string | null;
          gen_fase: string | null;
          gen_fecha_fabricacion: string | null;
          gen_marca: string | null;
          gen_modelo: string | null;
          gen_numero_serie: string | null;
          id: string;
          last_modified: string;
          planilla_espacial: boolean;
          sistema_adquisicion: string | null;
          sync_status: string;
          tipo_equipo: string | null;
          ubicacion_id: string;
        };
        Insert: {
          bucky?: string | null;
          creado_en?: string;
          distancia_foco_paciente?: number | null;
          filtracion_anadida_mmal?: number | null;
          filtracion_inherente_mmal?: number | null;
          gen_energia_fotones_mev?: string | null;
          gen_fase?: string | null;
          gen_fecha_fabricacion?: string | null;
          gen_marca?: string | null;
          gen_modelo?: string | null;
          gen_numero_serie?: string | null;
          id?: string;
          last_modified?: string;
          planilla_espacial?: boolean;
          sistema_adquisicion?: string | null;
          sync_status?: string;
          tipo_equipo?: string | null;
          ubicacion_id: string;
        };
        Update: {
          bucky?: string | null;
          creado_en?: string;
          distancia_foco_paciente?: number | null;
          filtracion_anadida_mmal?: number | null;
          filtracion_inherente_mmal?: number | null;
          gen_energia_fotones_mev?: string | null;
          gen_fase?: string | null;
          gen_fecha_fabricacion?: string | null;
          gen_marca?: string | null;
          gen_modelo?: string | null;
          gen_numero_serie?: string | null;
          id?: string;
          last_modified?: string;
          planilla_espacial?: boolean;
          sistema_adquisicion?: string | null;
          sync_status?: string;
          tipo_equipo?: string | null;
          ubicacion_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "equipos_ubicacion_id_fkey";
            columns: ["ubicacion_id"];
            isOneToOne: false;
            referencedRelation: "ubicaciones_rx";
            referencedColumns: ["id"];
          },
        ];
      };
      evidencias: {
        Row: {
          creado_en: string;
          descripcion: string | null;
          fecha_captura: string | null;
          id: string;
          last_modified: string;
          prueba_resultado_id: string | null;
          storage_path: string | null;
          sync_status: string;
          tipo: string | null;
          url_storage: string | null;
          visita_id: string;
        };
        Insert: {
          creado_en?: string;
          descripcion?: string | null;
          fecha_captura?: string | null;
          id?: string;
          last_modified?: string;
          prueba_resultado_id?: string | null;
          storage_path?: string | null;
          sync_status?: string;
          tipo?: string | null;
          url_storage?: string | null;
          visita_id: string;
        };
        Update: {
          creado_en?: string;
          descripcion?: string | null;
          fecha_captura?: string | null;
          id?: string;
          last_modified?: string;
          prueba_resultado_id?: string | null;
          storage_path?: string | null;
          sync_status?: string;
          tipo?: string | null;
          url_storage?: string | null;
          visita_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "evidencias_prueba_resultado_id_fkey";
            columns: ["prueba_resultado_id"];
            isOneToOne: false;
            referencedRelation: "prueba_resultados";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evidencias_visita_id_fkey";
            columns: ["visita_id"];
            isOneToOne: false;
            referencedRelation: "visitas";
            referencedColumns: ["id"];
          },
        ];
      };
      gantry: {
        Row: {
          creado_en: string;
          equipo_id: string;
          id: string;
          last_modified: string;
          marca: string | null;
          modelo: string | null;
          numero_serie: string | null;
          sync_status: string;
          tipo_detector: string | null;
        };
        Insert: {
          creado_en?: string;
          equipo_id: string;
          id?: string;
          last_modified?: string;
          marca?: string | null;
          modelo?: string | null;
          numero_serie?: string | null;
          sync_status?: string;
          tipo_detector?: string | null;
        };
        Update: {
          creado_en?: string;
          equipo_id?: string;
          id?: string;
          last_modified?: string;
          marca?: string | null;
          modelo?: string | null;
          numero_serie?: string | null;
          sync_status?: string;
          tipo_detector?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "gantry_equipo_id_fkey";
            columns: ["equipo_id"];
            isOneToOne: false;
            referencedRelation: "equipos";
            referencedColumns: ["id"];
          },
        ];
      };
      grupo_pruebas: {
        Row: {
          activo: boolean;
          codigo: string;
          creado_en: string;
          id: string;
          nombre: string;
          orden: number;
          schema_mediciones: Json;
          slots_imagen: Json;
          tipo_equipo: string;
        };
        Insert: {
          activo?: boolean;
          codigo: string;
          creado_en?: string;
          id?: string;
          nombre: string;
          orden?: number;
          schema_mediciones?: Json;
          slots_imagen?: Json;
          tipo_equipo: string;
        };
        Update: {
          activo?: boolean;
          codigo?: string;
          creado_en?: string;
          id?: string;
          nombre?: string;
          orden?: number;
          schema_mediciones?: Json;
          slots_imagen?: Json;
          tipo_equipo?: string;
        };
        Relationships: [];
      };
      grupo_resultados: {
        Row: {
          completado: boolean;
          creado_en: string;
          equipo_id: string;
          fecha_ejecucion: string | null;
          grupo_id: string;
          id: string;
          imagenes: Json;
          last_modified: string;
          mediciones_json: Json;
          sync_status: string;
          visita_id: string;
        };
        Insert: {
          completado?: boolean;
          creado_en?: string;
          equipo_id: string;
          fecha_ejecucion?: string | null;
          grupo_id: string;
          id?: string;
          imagenes?: Json;
          last_modified?: string;
          mediciones_json?: Json;
          sync_status?: string;
          visita_id: string;
        };
        Update: {
          completado?: boolean;
          creado_en?: string;
          equipo_id?: string;
          fecha_ejecucion?: string | null;
          grupo_id?: string;
          id?: string;
          imagenes?: Json;
          last_modified?: string;
          mediciones_json?: Json;
          sync_status?: string;
          visita_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "grupo_resultados_equipo_id_fkey";
            columns: ["equipo_id"];
            isOneToOne: false;
            referencedRelation: "equipos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "grupo_resultados_grupo_id_fkey";
            columns: ["grupo_id"];
            isOneToOne: false;
            referencedRelation: "grupo_pruebas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "grupo_resultados_visita_id_fkey";
            columns: ["visita_id"];
            isOneToOne: false;
            referencedRelation: "visitas";
            referencedColumns: ["id"];
          },
        ];
      };
      informe_versiones: {
        Row: {
          creado_en: string;
          descripcion_cambio: string | null;
          estado: string | null;
          fecha_aprobacion: string | null;
          fecha_generacion: string;
          fecha_revision: string | null;
          generado_por_id: string | null;
          id: string;
          informe_id: string;
          last_modified: string;
          motivo_cambio: string | null;
          numero_version: number;
          pdf_url: string | null;
          revisado_por_id: string | null;
          sync_status: string;
        };
        Insert: {
          creado_en?: string;
          descripcion_cambio?: string | null;
          estado?: string | null;
          fecha_aprobacion?: string | null;
          fecha_generacion: string;
          fecha_revision?: string | null;
          generado_por_id?: string | null;
          id?: string;
          informe_id: string;
          last_modified?: string;
          motivo_cambio?: string | null;
          numero_version: number;
          pdf_url?: string | null;
          revisado_por_id?: string | null;
          sync_status?: string;
        };
        Update: {
          creado_en?: string;
          descripcion_cambio?: string | null;
          estado?: string | null;
          fecha_aprobacion?: string | null;
          fecha_generacion?: string;
          fecha_revision?: string | null;
          generado_por_id?: string | null;
          id?: string;
          informe_id?: string;
          last_modified?: string;
          motivo_cambio?: string | null;
          numero_version?: number;
          pdf_url?: string | null;
          revisado_por_id?: string | null;
          sync_status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "informe_versiones_generado_por_id_fkey";
            columns: ["generado_por_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "informe_versiones_informe_id_fkey";
            columns: ["informe_id"];
            isOneToOne: false;
            referencedRelation: "informes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "informe_versiones_revisado_por_id_fkey";
            columns: ["revisado_por_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ];
      };
      informes: {
        Row: {
          concepto_general: string | null;
          creado_en: string;
          equipo_id: string;
          estado: string;
          fecha_emision: string;
          fecha_vencimiento: string;
          id: string;
          last_modified: string;
          numero_informe: string;
          plantilla: string | null;
          qr_token: string;
          qr_url: string | null;
          sync_status: string;
          titulo: string | null;
          ubicacion_id: string;
          version_actual: number;
          visita_id: string;
        };
        Insert: {
          concepto_general?: string | null;
          creado_en?: string;
          equipo_id: string;
          estado?: string;
          fecha_emision: string;
          fecha_vencimiento: string;
          id?: string;
          last_modified?: string;
          numero_informe: string;
          plantilla?: string | null;
          qr_token?: string;
          qr_url?: string | null;
          sync_status?: string;
          titulo?: string | null;
          ubicacion_id: string;
          version_actual?: number;
          visita_id: string;
        };
        Update: {
          concepto_general?: string | null;
          creado_en?: string;
          equipo_id?: string;
          estado?: string;
          fecha_emision?: string;
          fecha_vencimiento?: string;
          id?: string;
          last_modified?: string;
          numero_informe?: string;
          plantilla?: string | null;
          qr_token?: string;
          qr_url?: string | null;
          sync_status?: string;
          titulo?: string | null;
          ubicacion_id?: string;
          version_actual?: number;
          visita_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "informes_equipo_id_fkey";
            columns: ["equipo_id"];
            isOneToOne: false;
            referencedRelation: "equipos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "informes_ubicacion_id_fkey";
            columns: ["ubicacion_id"];
            isOneToOne: false;
            referencedRelation: "ubicaciones_rx";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "informes_visita_id_fkey";
            columns: ["visita_id"];
            isOneToOne: false;
            referencedRelation: "visitas";
            referencedColumns: ["id"];
          },
        ];
      };
      mediciones_radiometricas: {
        Row: {
          concepto: string | null;
          creado_en: string;
          dosis_anual_msv: number | null;
          factor_ocupacion: string | null;
          id: string;
          last_modified: string;
          observacion: string | null;
          punto_numero: number;
          sync_status: string;
          tasa_dosis_msv_h: number | null;
          tipo_area: string | null;
          ubicacion_descripcion: string;
          visita_id: string;
        };
        Insert: {
          concepto?: string | null;
          creado_en?: string;
          dosis_anual_msv?: number | null;
          factor_ocupacion?: string | null;
          id?: string;
          last_modified?: string;
          observacion?: string | null;
          punto_numero: number;
          sync_status?: string;
          tasa_dosis_msv_h?: number | null;
          tipo_area?: string | null;
          ubicacion_descripcion: string;
          visita_id: string;
        };
        Update: {
          concepto?: string | null;
          creado_en?: string;
          dosis_anual_msv?: number | null;
          factor_ocupacion?: string | null;
          id?: string;
          last_modified?: string;
          observacion?: string | null;
          punto_numero?: number;
          sync_status?: string;
          tasa_dosis_msv_h?: number | null;
          tipo_area?: string | null;
          ubicacion_descripcion?: string;
          visita_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mediciones_radiometricas_visita_id_fkey";
            columns: ["visita_id"];
            isOneToOne: false;
            referencedRelation: "visitas";
            referencedColumns: ["id"];
          },
        ];
      };
      municipios: {
        Row: {
          codigo_dane: string;
          departamento_id: number;
          id: number;
          nombre: string;
        };
        Insert: {
          codigo_dane: string;
          departamento_id: number;
          id: number;
          nombre: string;
        };
        Update: {
          codigo_dane?: string;
          departamento_id?: number;
          id?: number;
          nombre?: string;
        };
        Relationships: [
          {
            foreignKeyName: "municipios_departamento_id_fkey";
            columns: ["departamento_id"];
            isOneToOne: false;
            referencedRelation: "departamentos";
            referencedColumns: ["id"];
          },
        ];
      };
      partes_equipo: {
        Row: {
          creado_en: string;
          equipo_id: string;
          estado: string | null;
          id: string;
          last_modified: string;
          observacion: string | null;
          parte_nombre: string;
          sync_status: string;
        };
        Insert: {
          creado_en?: string;
          equipo_id: string;
          estado?: string | null;
          id?: string;
          last_modified?: string;
          observacion?: string | null;
          parte_nombre: string;
          sync_status?: string;
        };
        Update: {
          creado_en?: string;
          equipo_id?: string;
          estado?: string | null;
          id?: string;
          last_modified?: string;
          observacion?: string | null;
          parte_nombre?: string;
          sync_status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "partes_equipo_equipo_id_fkey";
            columns: ["equipo_id"];
            isOneToOne: false;
            referencedRelation: "equipos";
            referencedColumns: ["id"];
          },
        ];
      };
      prueba_definiciones: {
        Row: {
          activa: boolean;
          codigo: string;
          creado_en: string;
          criterios_aceptacion: Json | null;
          descripcion: string | null;
          formulas: Json | null;
          grupo_id: string | null;
          id: string;
          nombre: string;
          numero_tecdoc: string | null;
          orden_en_grupo: number | null;
          orden_sugerido: number | null;
          plantilla_informe: string | null;
          slots_imagen: Json | null;
          textos_informe: Json | null;
          tipos_equipo_aplicables: string[];
        };
        Insert: {
          activa?: boolean;
          codigo: string;
          creado_en?: string;
          criterios_aceptacion?: Json | null;
          descripcion?: string | null;
          formulas?: Json | null;
          grupo_id?: string | null;
          id?: string;
          nombre: string;
          numero_tecdoc?: string | null;
          orden_en_grupo?: number | null;
          orden_sugerido?: number | null;
          plantilla_informe?: string | null;
          slots_imagen?: Json | null;
          textos_informe?: Json | null;
          tipos_equipo_aplicables?: string[];
        };
        Update: {
          activa?: boolean;
          codigo?: string;
          creado_en?: string;
          criterios_aceptacion?: Json | null;
          descripcion?: string | null;
          formulas?: Json | null;
          grupo_id?: string | null;
          id?: string;
          nombre?: string;
          numero_tecdoc?: string | null;
          orden_en_grupo?: number | null;
          orden_sugerido?: number | null;
          plantilla_informe?: string | null;
          slots_imagen?: Json | null;
          textos_informe?: Json | null;
          tipos_equipo_aplicables?: string[];
        };
        Relationships: [
          {
            foreignKeyName: "fk_prueba_def_grupo";
            columns: ["grupo_id"];
            isOneToOne: false;
            referencedRelation: "grupo_pruebas";
            referencedColumns: ["id"];
          },
        ];
      };
      prueba_resultados: {
        Row: {
          acciones_correctivas: string | null;
          completado: boolean;
          concepto: string | null;
          creado_en: string;
          datos_json: Json | null;
          equipo_id: string;
          evaluacion_criterios: Json | null;
          fecha_ejecucion: string | null;
          grupo_resultado_id: string | null;
          id: string;
          imagenes: Json | null;
          last_modified: string;
          prueba_definicion_id: string;
          resultados_calculados: Json | null;
          sync_status: string;
          visita_id: string;
        };
        Insert: {
          acciones_correctivas?: string | null;
          completado?: boolean;
          concepto?: string | null;
          creado_en?: string;
          datos_json?: Json | null;
          equipo_id: string;
          evaluacion_criterios?: Json | null;
          fecha_ejecucion?: string | null;
          grupo_resultado_id?: string | null;
          id?: string;
          imagenes?: Json | null;
          last_modified?: string;
          prueba_definicion_id: string;
          resultados_calculados?: Json | null;
          sync_status?: string;
          visita_id: string;
        };
        Update: {
          acciones_correctivas?: string | null;
          completado?: boolean;
          concepto?: string | null;
          creado_en?: string;
          datos_json?: Json | null;
          equipo_id?: string;
          evaluacion_criterios?: Json | null;
          fecha_ejecucion?: string | null;
          grupo_resultado_id?: string | null;
          id?: string;
          imagenes?: Json | null;
          last_modified?: string;
          prueba_definicion_id?: string;
          resultados_calculados?: Json | null;
          sync_status?: string;
          visita_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "prueba_resultados_equipo_id_fkey";
            columns: ["equipo_id"];
            isOneToOne: false;
            referencedRelation: "equipos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "prueba_resultados_grupo_resultado_id_fkey";
            columns: ["grupo_resultado_id"];
            isOneToOne: false;
            referencedRelation: "grupo_resultados";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "prueba_resultados_prueba_definicion_id_fkey";
            columns: ["prueba_definicion_id"];
            isOneToOne: false;
            referencedRelation: "prueba_definiciones";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "prueba_resultados_visita_id_fkey";
            columns: ["visita_id"];
            isOneToOne: false;
            referencedRelation: "visitas";
            referencedColumns: ["id"];
          },
        ];
      };
      rol_permisos: {
        Row: {
          accion: string;
          cargo: string;
          id: string;
          last_modified: string;
          permitido: boolean;
          recurso: string;
          sync_status: string;
        };
        Insert: {
          accion: string;
          cargo: string;
          id?: string;
          last_modified?: string;
          permitido?: boolean;
          recurso: string;
          sync_status?: string;
        };
        Update: {
          accion?: string;
          cargo?: string;
          id?: string;
          last_modified?: string;
          permitido?: boolean;
          recurso?: string;
          sync_status?: string;
        };
        Relationships: [];
      };
      sala_dimensiones: {
        Row: {
          alto_m: number | null;
          ancho_m: number | null;
          area_m2: number | null;
          creado_en: string;
          id: string;
          largo_m: number | null;
          last_modified: string;
          plano_url: string | null;
          sync_status: string;
          ubicacion_id: string;
          zona_a_desc: string | null;
          zona_b_desc: string | null;
          zona_c_desc: string | null;
          zona_d_desc: string | null;
        };
        Insert: {
          alto_m?: number | null;
          ancho_m?: number | null;
          area_m2?: number | null;
          creado_en?: string;
          id?: string;
          largo_m?: number | null;
          last_modified?: string;
          plano_url?: string | null;
          sync_status?: string;
          ubicacion_id: string;
          zona_a_desc?: string | null;
          zona_b_desc?: string | null;
          zona_c_desc?: string | null;
          zona_d_desc?: string | null;
        };
        Update: {
          alto_m?: number | null;
          ancho_m?: number | null;
          area_m2?: number | null;
          creado_en?: string;
          id?: string;
          largo_m?: number | null;
          last_modified?: string;
          plano_url?: string | null;
          sync_status?: string;
          ubicacion_id?: string;
          zona_a_desc?: string | null;
          zona_b_desc?: string | null;
          zona_c_desc?: string | null;
          zona_d_desc?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sala_dimensiones_ubicacion_id_fkey";
            columns: ["ubicacion_id"];
            isOneToOne: false;
            referencedRelation: "ubicaciones_rx";
            referencedColumns: ["id"];
          },
        ];
      };
      sedes: {
        Row: {
          ciudad: string | null;
          cliente_id: string;
          creado_en: string;
          departamento: string | null;
          departamento_id: number | null;
          direccion_sede: string | null;
          email: string | null;
          id: string;
          last_modified: string;
          municipio_id: number | null;
          nombre_sede: string;
          sync_status: string;
          telefono: string | null;
        };
        Insert: {
          ciudad?: string | null;
          cliente_id: string;
          creado_en?: string;
          departamento?: string | null;
          departamento_id?: number | null;
          direccion_sede?: string | null;
          email?: string | null;
          id?: string;
          last_modified?: string;
          municipio_id?: number | null;
          nombre_sede: string;
          sync_status?: string;
          telefono?: string | null;
        };
        Update: {
          ciudad?: string | null;
          cliente_id?: string;
          creado_en?: string;
          departamento?: string | null;
          departamento_id?: number | null;
          direccion_sede?: string | null;
          email?: string | null;
          id?: string;
          last_modified?: string;
          municipio_id?: number | null;
          nombre_sede?: string;
          sync_status?: string;
          telefono?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sedes_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sedes_departamento_id_fkey";
            columns: ["departamento_id"];
            isOneToOne: false;
            referencedRelation: "departamentos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sedes_municipio_id_fkey";
            columns: ["municipio_id"];
            isOneToOne: false;
            referencedRelation: "municipios";
            referencedColumns: ["id"];
          },
        ];
      };
      solicitudes: {
        Row: {
          cliente_id: string;
          contacto_programar_id: string | null;
          cotizacion_id: string | null;
          creado_en: string;
          fecha_entrega: string | null;
          fecha_estimada_visita: string | null;
          fecha_real_visita: string | null;
          fecha_solicitud: string | null;
          forma_pago: string | null;
          id: string;
          last_modified: string;
          pago_recibido: boolean;
          pipeline_estado: string;
          sync_status: string;
          tecnico_asignado_id: string | null;
          tipo_servicio: string | null;
          ubicacion_id: string | null;
        };
        Insert: {
          cliente_id: string;
          contacto_programar_id?: string | null;
          cotizacion_id?: string | null;
          creado_en?: string;
          fecha_entrega?: string | null;
          fecha_estimada_visita?: string | null;
          fecha_real_visita?: string | null;
          fecha_solicitud?: string | null;
          forma_pago?: string | null;
          id?: string;
          last_modified?: string;
          pago_recibido?: boolean;
          pipeline_estado?: string;
          sync_status?: string;
          tecnico_asignado_id?: string | null;
          tipo_servicio?: string | null;
          ubicacion_id?: string | null;
        };
        Update: {
          cliente_id?: string;
          contacto_programar_id?: string | null;
          cotizacion_id?: string | null;
          creado_en?: string;
          fecha_entrega?: string | null;
          fecha_estimada_visita?: string | null;
          fecha_real_visita?: string | null;
          fecha_solicitud?: string | null;
          forma_pago?: string | null;
          id?: string;
          last_modified?: string;
          pago_recibido?: boolean;
          pipeline_estado?: string;
          sync_status?: string;
          tecnico_asignado_id?: string | null;
          tipo_servicio?: string | null;
          ubicacion_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "solicitudes_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "solicitudes_contacto_programar_id_fkey";
            columns: ["contacto_programar_id"];
            isOneToOne: false;
            referencedRelation: "contactos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "solicitudes_cotizacion_id_fkey";
            columns: ["cotizacion_id"];
            isOneToOne: false;
            referencedRelation: "cotizaciones";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "solicitudes_tecnico_asignado_id_fkey";
            columns: ["tecnico_asignado_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "solicitudes_ubicacion_id_fkey";
            columns: ["ubicacion_id"];
            isOneToOne: false;
            referencedRelation: "ubicaciones_rx";
            referencedColumns: ["id"];
          },
        ];
      };
      tubos: {
        Row: {
          creado_en: string;
          equipo_id: string;
          foco_fino_mm: number | null;
          foco_grueso_mm: number | null;
          id: string;
          kv_max: number | null;
          last_modified: string;
          ma_max: number | null;
          marca: string | null;
          mas_max: number | null;
          modelo: string | null;
          numero_serie: string | null;
          sync_status: string;
          tiempo_s: number | null;
          tipo: string | null;
        };
        Insert: {
          creado_en?: string;
          equipo_id: string;
          foco_fino_mm?: number | null;
          foco_grueso_mm?: number | null;
          id?: string;
          kv_max?: number | null;
          last_modified?: string;
          ma_max?: number | null;
          marca?: string | null;
          mas_max?: number | null;
          modelo?: string | null;
          numero_serie?: string | null;
          sync_status?: string;
          tiempo_s?: number | null;
          tipo?: string | null;
        };
        Update: {
          creado_en?: string;
          equipo_id?: string;
          foco_fino_mm?: number | null;
          foco_grueso_mm?: number | null;
          id?: string;
          kv_max?: number | null;
          last_modified?: string;
          ma_max?: number | null;
          marca?: string | null;
          mas_max?: number | null;
          modelo?: string | null;
          numero_serie?: string | null;
          sync_status?: string;
          tiempo_s?: number | null;
          tipo?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tubos_equipo_id_fkey";
            columns: ["equipo_id"];
            isOneToOne: false;
            referencedRelation: "equipos";
            referencedColumns: ["id"];
          },
        ];
      };
      ubicaciones_rx: {
        Row: {
          alto_m: number | null;
          ancho_m: number | null;
          area_m2: number | null;
          codigo_habilitacion: string | null;
          creado_en: string;
          fecha_expiracion_licencia: string | null;
          horas_x_dia: number | null;
          id: string;
          largo_m: number | null;
          last_modified: string;
          licencia: string | null;
          nombre_servicio: string;
          piso_desc: string | null;
          sede_id: string;
          sync_status: string;
          techo_desc: string | null;
          ubicacion_fisica: string | null;
          zona_a_desc: string | null;
          zona_b_desc: string | null;
          zona_c_desc: string | null;
          zona_d_desc: string | null;
        };
        Insert: {
          alto_m?: number | null;
          ancho_m?: number | null;
          area_m2?: number | null;
          codigo_habilitacion?: string | null;
          creado_en?: string;
          fecha_expiracion_licencia?: string | null;
          horas_x_dia?: number | null;
          id?: string;
          largo_m?: number | null;
          last_modified?: string;
          licencia?: string | null;
          nombre_servicio: string;
          piso_desc?: string | null;
          sede_id: string;
          sync_status?: string;
          techo_desc?: string | null;
          ubicacion_fisica?: string | null;
          zona_a_desc?: string | null;
          zona_b_desc?: string | null;
          zona_c_desc?: string | null;
          zona_d_desc?: string | null;
        };
        Update: {
          alto_m?: number | null;
          ancho_m?: number | null;
          area_m2?: number | null;
          codigo_habilitacion?: string | null;
          creado_en?: string;
          fecha_expiracion_licencia?: string | null;
          horas_x_dia?: number | null;
          id?: string;
          largo_m?: number | null;
          last_modified?: string;
          licencia?: string | null;
          nombre_servicio?: string;
          piso_desc?: string | null;
          sede_id?: string;
          sync_status?: string;
          techo_desc?: string | null;
          ubicacion_fisica?: string | null;
          zona_a_desc?: string | null;
          zona_b_desc?: string | null;
          zona_c_desc?: string | null;
          zona_d_desc?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ubicaciones_rx_sede_id_fkey";
            columns: ["sede_id"];
            isOneToOne: false;
            referencedRelation: "sedes";
            referencedColumns: ["id"];
          },
        ];
      };
      usuarios: {
        Row: {
          activo: boolean;
          auth_uid: string | null;
          cargo: string | null;
          cedula: string;
          creado_en: string;
          email: string | null;
          id: string;
          last_modified: string;
          nombre: string;
          sync_status: string;
          telefono: string | null;
        };
        Insert: {
          activo?: boolean;
          auth_uid?: string | null;
          cargo?: string | null;
          cedula: string;
          creado_en?: string;
          email?: string | null;
          id?: string;
          last_modified?: string;
          nombre: string;
          sync_status?: string;
          telefono?: string | null;
        };
        Update: {
          activo?: boolean;
          auth_uid?: string | null;
          cargo?: string | null;
          cedula?: string;
          creado_en?: string;
          email?: string | null;
          id?: string;
          last_modified?: string;
          nombre?: string;
          sync_status?: string;
          telefono?: string | null;
        };
        Relationships: [];
      };
      valores_referencia: {
        Row: {
          bajo_contraste_ref: number | null;
          cae_comp_1mm_cu: number | null;
          cae_comp_2mm_cu: number | null;
          cae_comp_3mm_cu: number | null;
          cae_comp_60kvp: number | null;
          cae_comp_70kvp: number | null;
          cae_comp_80kvp: number | null;
          cae_sensibilidad_ref: number | null;
          chr_min_mmal: number | null;
          creado_en: string;
          ddi_ref: number | null;
          dosis_receptor_abdomen: number | null;
          dosis_receptor_columna: number | null;
          dosis_receptor_extremidad: number | null;
          dosis_receptor_torax: number | null;
          ei_ref: number | null;
          equipo_id: string;
          id: string;
          kerma_aire_incidente: number | null;
          last_modified: string;
          mtf20_h_ref: number | null;
          mtf20_v_ref: number | null;
          mtf50_h_ref: number | null;
          mtf50_v_ref: number | null;
          pka_ref: number | null;
          pkl_ct_dental: number | null;
          pkl_panoramico: number | null;
          rendimiento_linealidad: number | null;
          rendimiento_ref: number | null;
          rendimiento_repetibilidad: number | null;
          sync_status: string;
          valor_base_patron: string | null;
        };
        Insert: {
          bajo_contraste_ref?: number | null;
          cae_comp_1mm_cu?: number | null;
          cae_comp_2mm_cu?: number | null;
          cae_comp_3mm_cu?: number | null;
          cae_comp_60kvp?: number | null;
          cae_comp_70kvp?: number | null;
          cae_comp_80kvp?: number | null;
          cae_sensibilidad_ref?: number | null;
          chr_min_mmal?: number | null;
          creado_en?: string;
          ddi_ref?: number | null;
          dosis_receptor_abdomen?: number | null;
          dosis_receptor_columna?: number | null;
          dosis_receptor_extremidad?: number | null;
          dosis_receptor_torax?: number | null;
          ei_ref?: number | null;
          equipo_id: string;
          id?: string;
          kerma_aire_incidente?: number | null;
          last_modified?: string;
          mtf20_h_ref?: number | null;
          mtf20_v_ref?: number | null;
          mtf50_h_ref?: number | null;
          mtf50_v_ref?: number | null;
          pka_ref?: number | null;
          pkl_ct_dental?: number | null;
          pkl_panoramico?: number | null;
          rendimiento_linealidad?: number | null;
          rendimiento_ref?: number | null;
          rendimiento_repetibilidad?: number | null;
          sync_status?: string;
          valor_base_patron?: string | null;
        };
        Update: {
          bajo_contraste_ref?: number | null;
          cae_comp_1mm_cu?: number | null;
          cae_comp_2mm_cu?: number | null;
          cae_comp_3mm_cu?: number | null;
          cae_comp_60kvp?: number | null;
          cae_comp_70kvp?: number | null;
          cae_comp_80kvp?: number | null;
          cae_sensibilidad_ref?: number | null;
          chr_min_mmal?: number | null;
          creado_en?: string;
          ddi_ref?: number | null;
          dosis_receptor_abdomen?: number | null;
          dosis_receptor_columna?: number | null;
          dosis_receptor_extremidad?: number | null;
          dosis_receptor_torax?: number | null;
          ei_ref?: number | null;
          equipo_id?: string;
          id?: string;
          kerma_aire_incidente?: number | null;
          last_modified?: string;
          mtf20_h_ref?: number | null;
          mtf20_v_ref?: number | null;
          mtf50_h_ref?: number | null;
          mtf50_v_ref?: number | null;
          pka_ref?: number | null;
          pkl_ct_dental?: number | null;
          pkl_panoramico?: number | null;
          rendimiento_linealidad?: number | null;
          rendimiento_ref?: number | null;
          rendimiento_repetibilidad?: number | null;
          sync_status?: string;
          valor_base_patron?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "valores_referencia_equipo_id_fkey";
            columns: ["equipo_id"];
            isOneToOne: false;
            referencedRelation: "equipos";
            referencedColumns: ["id"];
          },
        ];
      };
      visitas: {
        Row: {
          creado_en: string;
          devuelto_en: string | null;
          dias_laborados_semana: number | null;
          equipo_id: string | null;
          estado_visita: string;
          fecha_visita: string | null;
          id: string;
          ingeniero_revisor_id: string | null;
          kv_maximo_usado: number | null;
          last_modified: string;
          mas_maximo_usado: number | null;
          max_disparos_paciente: number | null;
          observaciones: string | null;
          observaciones_revision: string | null;
          pacientes_por_semana: number | null;
          porcentaje_rechazo: number | null;
          presion_hpa: number | null;
          radiografias_por_semana: number | null;
          solicitud_id: string;
          sync_status: string;
          tecnico_id: string | null;
          temperatura_c: number | null;
          ubicacion_id: string | null;
        };
        Insert: {
          creado_en?: string;
          devuelto_en?: string | null;
          dias_laborados_semana?: number | null;
          equipo_id?: string | null;
          estado_visita?: string;
          fecha_visita?: string | null;
          id?: string;
          ingeniero_revisor_id?: string | null;
          kv_maximo_usado?: number | null;
          last_modified?: string;
          mas_maximo_usado?: number | null;
          max_disparos_paciente?: number | null;
          observaciones?: string | null;
          observaciones_revision?: string | null;
          pacientes_por_semana?: number | null;
          porcentaje_rechazo?: number | null;
          presion_hpa?: number | null;
          radiografias_por_semana?: number | null;
          solicitud_id: string;
          sync_status?: string;
          tecnico_id?: string | null;
          temperatura_c?: number | null;
          ubicacion_id?: string | null;
        };
        Update: {
          creado_en?: string;
          devuelto_en?: string | null;
          dias_laborados_semana?: number | null;
          equipo_id?: string | null;
          estado_visita?: string;
          fecha_visita?: string | null;
          id?: string;
          ingeniero_revisor_id?: string | null;
          kv_maximo_usado?: number | null;
          last_modified?: string;
          mas_maximo_usado?: number | null;
          max_disparos_paciente?: number | null;
          observaciones?: string | null;
          observaciones_revision?: string | null;
          pacientes_por_semana?: number | null;
          porcentaje_rechazo?: number | null;
          presion_hpa?: number | null;
          radiografias_por_semana?: number | null;
          solicitud_id?: string;
          sync_status?: string;
          tecnico_id?: string | null;
          temperatura_c?: number | null;
          ubicacion_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "visitas_equipo_id_fkey";
            columns: ["equipo_id"];
            isOneToOne: false;
            referencedRelation: "equipos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visitas_ingeniero_revisor_id_fkey";
            columns: ["ingeniero_revisor_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visitas_solicitud_id_fkey";
            columns: ["solicitud_id"];
            isOneToOne: false;
            referencedRelation: "solicitudes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visitas_tecnico_id_fkey";
            columns: ["tecnico_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visitas_ubicacion_id_fkey";
            columns: ["ubicacion_id"];
            isOneToOne: false;
            referencedRelation: "ubicaciones_rx";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_usuario_id: { Args: never; Returns: string };
      is_admin: { Args: never; Returns: boolean };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
