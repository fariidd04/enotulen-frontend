const API_BASE_URL = `${import.meta.env.VITE_API_URL}/api`;

export const notulenAPI = {
  getAll: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/notulens`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching notulens:', error);
      throw new Error('Gagal mengambil data dari server.');
    }
  },

  create: async (notulen) => {
    try {
      const response = await fetch(`${API_BASE_URL}/notulens`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notulen),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Gagal menyimpan notulen');
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating notulen:', error);
      throw error;
    }
  },

  delete: async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/notulens/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Gagal menghapus notulen');
      }

      return await response.json();
    } catch (error) {
      console.error('Error deleting notulen:', error);
      throw error;
    }
  },
};
