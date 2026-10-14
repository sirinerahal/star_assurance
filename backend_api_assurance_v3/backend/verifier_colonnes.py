import pickle
with open("model/colonnes_modele.pkl", "rb") as f:
    print(pickle.load(f))