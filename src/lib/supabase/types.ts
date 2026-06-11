// ============================================================
//  Tipos de la base de datos Supabase (PostgreSQL)
//  Mapeados desde los tipos Dexie existentes
//
//  Regenerar con: npx supabase gen types typescript
//  cuando el schema cambie en Supabase
// ============================================================

export interface Database {
  public: {
    Tables: {
      clientes: {
        Row: {
          id: number;
          nombre_cliente: string;
          nombre_prestador: string | null;
          nit: string;
          digito_verificacion: string | null;
          naturaleza: "privado" | "publico" | "mixto" | null;
          direccion: string | null;
          telefono: string | null;
          email: string | null;
          nombre_representante_legal: string | null;
          creado_en: string;
        };
        Insert: Omit<Database["public"]["Tables"]["clientes"]["Row"], "id" | "creado_en"> & {
          id?: number;
          creado_en?: string;
        };
        Update: Partial<Database["public"]["Tables"]["clientes"]["Insert"]>;
      };
      contactos: {
        Row: {
          id: number;
          cliente_id: number;
          nombre: string;
          cargo: string | null;
          cedula: string | null;
          telefono: string | null;
          email: string | null;
          para_programar: boolean;
          creado_en: string;
        };
        Insert: Omit<Database["public"]["Tables"]["contactos"]["Row"], "id" | "creado_en"> & {
          id?: number;
          creado_en?: string;
        };
        Update: Partial<Database["public"]["Tables"]["contactos"]["Insert"]>;
      };
      sedes: {
        Row: {
          id: number;
          cliente_id: number;
          nombre_sede: string;
          direccion_sede: string | null;
          ciudad: string | null;
          departamento: string | null;
          email: string | null;
          telefono: string | null;
          departamento_id: number | null;
          municipio_id: number | null;
          creado_en: string;
        };
        Insert: Omit<Database["public"]["Tables"]["sedes"]["Row"], "id" | "creado_en"> & {
          id?: number;
          creado_en?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sedes"]["Insert"]>;
      };
      departamentos: {
        Row: {
          id: number;
          codigo_dane: string;
          nombre: string;
        };
        Insert: Database["public"]["Tables"]["departamentos"]["Row"];
        Update: Partial<Database["public"]["Tables"]["departamentos"]["Row"]>;
      };
      municipios: {
        Row: {
          id: number;
          departamento_id: number;
          codigo_dane: string;
          nombre: string;
        };
        Insert: Database["public"]["Tables"]["municipios"]["Row"];
        Update: Partial<Database["public"]["Tables"]["municipios"]["Row"]>;
      };
      ubicaciones_rx: {
        Row: {
          id: number;
          sede_id: number;
          nombre_servicio: string;
          licencia: string | null;
          fecha_expiracion_licencia: string | null;
          codigo_habilitacion: string | null;
          horas_x_dia: number | null;
          creado_en: string;
        };
        Insert: Omit<Database["public"]["Tables"]["ubicaciones_rx"]["Row"], "id" | "creado_en"> & {
          id?: number;
          creado_en?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ubicaciones_rx"]["Insert"]>;
      };
      equipos: {
        Row: {
          id: number;
          ubicacion_id: number;
          tipo_equipo: string | null;
          planilla_espacial: boolean;
          sistema_adquisicion: string | null;
          distancia_foco_paciente: number | null;
          bucky: string | null;
          gen_marca: string | null;
          gen_modelo: string | null;
          gen_numero_serie: string | null;
          gen_fecha_fabricacion: string | null;
          gen_fase: string | null;
          gen_energia_fotones_mev: string | null;
          filtracion_inherente_mmal: number | null;
          filtracion_anadida_mmal: number | null;
          creado_en: string;
        };
        Insert: Omit<Database["public"]["Tables"]["equipos"]["Row"], "id" | "creado_en"> & {
          id?: number;
          creado_en?: string;
        };
        Update: Partial<Database["public"]["Tables"]["equipos"]["Insert"]>;
      };
      usuarios: {
        Row: {
          id: number;
          auth_uid: string | null;
          nombre: string;
          cedula: string;
          cargo: "coordinador" | "programador" | "tecnico" | "comercial";
          email: string | null;
          telefono: string | null;
          activo: boolean;
          creado_en: string;
        };
        Insert: Omit<Database["public"]["Tables"]["usuarios"]["Row"], "id" | "creado_en"> & {
          id?: number;
          creado_en?: string;
        };
        Update: Partial<Database["public"]["Tables"]["usuarios"]["Insert"]>;
      };
      rol_permisos: {
        Row: {
          id: number;
          rol: "coordinador" | "programador" | "tecnico" | "comercial";
          modulo: string;
          activo: boolean;
          crear: boolean | null;
          editar: boolean | null;
          eliminar: boolean | null;
          modificado_en: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["rol_permisos"]["Row"],
          "id" | "modificado_en"
        > & {
          id?: number;
          modificado_en?: string;
        };
        Update: Partial<Database["public"]["Tables"]["rol_permisos"]["Insert"]>;
      };
      solicitudes: {
        Row: {
          id: number;
          cotizacion_id: number | null;
          cliente_id: number;
          contacto_programar_id: number | null;
          ubicacion_id: number | null;
          tecnico_asignado_id: number | null;
          tipo_servicio: string | null;
          pipeline_estado: string;
          forma_pago: string | null;
          pago_recibido: boolean;
          fecha_solicitud: string | null;
          fecha_estimada_visita: string | null;
          fecha_real_visita: string | null;
          fecha_entrega: string | null;
          creado_en: string;
        };
        Insert: Omit<Database["public"]["Tables"]["solicitudes"]["Row"], "id" | "creado_en"> & {
          id?: number;
          creado_en?: string;
        };
        Update: Partial<Database["public"]["Tables"]["solicitudes"]["Insert"]>;
      };
      visitas: {
        Row: {
          id: number;
          solicitud_id: number;
          equipo_id: number | null;
          ubicacion_id: number | null;
          tecnico_id: number | null;
          estado_visita: string;
          ingeniero_revisor_id: number | null;
          dias_laborados_semana: number | null;
          pacientes_por_semana: number | null;
          radiografias_por_semana: number | null;
          kv_maximo_usado: number | null;
          mas_maximo_usado: number | null;
          max_disparos_paciente: number | null;
          porcentaje_rechazo: number | null;
          temperatura_c: number | null;
          presion_hpa: number | null;
          observaciones: string | null;
          observaciones_revision: string | null;
          devuelto_en: string | null;
          fecha_visita: string | null;
          last_modified: string;
          creado_en: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["visitas"]["Row"],
          "id" | "creado_en" | "last_modified"
        > & {
          id?: number;
          creado_en?: string;
          last_modified?: string;
        };
        Update: Partial<Database["public"]["Tables"]["visitas"]["Insert"]>;
      };
      prueba_resultados: {
        Row: {
          id: number;
          visita_id: number;
          prueba_definicion_id: number;
          equipo_id: number;
          concepto: string | null;
          acciones_correctivas: string | null;
          datos_json: Record<string, unknown> | null;
          completado: boolean;
          fecha_ejecucion: string | null;
          last_modified: string;
          creado_en: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["prueba_resultados"]["Row"],
          "id" | "creado_en" | "last_modified"
        > & {
          id?: number;
          creado_en?: string;
          last_modified?: string;
        };
        Update: Partial<Database["public"]["Tables"]["prueba_resultados"]["Insert"]>;
      };
      mediciones_radiometricas: {
        Row: {
          id: number;
          visita_id: number;
          punto_numero: number;
          ubicacion_descripcion: string;
          tasa_dosis_msv_h: number | null;
          factor_ocupacion: string | null;
          tipo_area: string | null;
          dosis_anual_msv: number | null;
          concepto: string | null;
          observacion: string | null;
          last_modified: string;
          creado_en: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["mediciones_radiometricas"]["Row"],
          "id" | "creado_en" | "last_modified"
        > & {
          id?: number;
          creado_en?: string;
          last_modified?: string;
        };
        Update: Partial<Database["public"]["Tables"]["mediciones_radiometricas"]["Insert"]>;
      };
      informes: {
        Row: {
          id: number;
          visita_id: number;
          equipo_id: number;
          ubicacion_id: number;
          numero_informe: string;
          plantilla: string | null;
          titulo: string | null;
          version_actual: number;
          concepto_general: string | null;
          qr_token: string;
          qr_url: string | null;
          fecha_emision: string;
          fecha_vencimiento: string;
          estado: string;
          creado_en: string;
        };
        Insert: Omit<Database["public"]["Tables"]["informes"]["Row"], "id" | "creado_en"> & {
          id?: number;
          creado_en?: string;
        };
        Update: Partial<Database["public"]["Tables"]["informes"]["Insert"]>;
      };
      tubos: {
        Row: {
          id: number;
          equipo_id: number;
          marca: string | null;
          modelo: string | null;
          numero_serie: string | null;
          tipo: string | null;
          mas_max: number | null;
          kv_max: number | null;
          ma_max: number | null;
          tiempo_s: number | null;
          foco_fino_mm: number | null;
          foco_grueso_mm: number | null;
          creado_en: string;
        };
        Insert: Omit<Database["public"]["Tables"]["tubos"]["Row"], "id" | "creado_en"> & {
          id?: number;
          creado_en?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tubos"]["Insert"]>;
      };
      colimadores: {
        Row: {
          id: number;
          equipo_id: number;
          marca: string | null;
          modelo: string | null;
          numero_serie: string | null;
          creado_en: string;
        };
        Insert: Omit<Database["public"]["Tables"]["colimadores"]["Row"], "id" | "creado_en"> & {
          id?: number;
          creado_en?: string;
        };
        Update: Partial<Database["public"]["Tables"]["colimadores"]["Insert"]>;
      };
      gantry: {
        Row: {
          id: number;
          equipo_id: number;
          marca: string | null;
          modelo: string | null;
          numero_serie: string | null;
          tipo_detector: string | null;
          creado_en: string;
        };
        Insert: Omit<Database["public"]["Tables"]["gantry"]["Row"], "id" | "creado_en"> & {
          id?: number;
          creado_en?: string;
        };
        Update: Partial<Database["public"]["Tables"]["gantry"]["Insert"]>;
      };
      grupo_resultados: {
        Row: {
          id: number;
          visita_id: number;
          grupo_id: number;
          equipo_id: number;
          mediciones_json: Record<string, unknown>[];
          imagenes: Record<string, unknown>[];
          completado: boolean;
          fecha_ejecucion: string | null;
          last_modified: string;
          creado_en: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["grupo_resultados"]["Row"],
          "id" | "creado_en" | "last_modified"
        > & {
          id?: number;
          creado_en?: string;
          last_modified?: string;
        };
        Update: Partial<Database["public"]["Tables"]["grupo_resultados"]["Insert"]>;
      };
      evidencias: {
        Row: {
          id: number;
          visita_id: number;
          prueba_resultado_id: number | null;
          tipo: string | null;
          descripcion: string | null;
          url_storage: string | null;
          fecha_captura: string | null;
          last_modified: string;
          creado_en: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["evidencias"]["Row"],
          "id" | "creado_en" | "last_modified"
        > & {
          id?: number;
          creado_en?: string;
          last_modified?: string;
        };
        Update: Partial<Database["public"]["Tables"]["evidencias"]["Insert"]>;
      };
      change_logs: {
        Row: {
          id: number;
          tabla: string;
          registro_id: number;
          campo: string;
          valor_anterior: string | null;
          valor_nuevo: string | null;
          modificado_por_id: number;
          fecha: string;
        };
        Insert: Omit<Database["public"]["Tables"]["change_logs"]["Row"], "id"> & {
          id?: number;
        };
        Update: Partial<Database["public"]["Tables"]["change_logs"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
