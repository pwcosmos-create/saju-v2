import random
import numpy as np

# --- Configuration ---
RL_EPISODES = 50000      # 50,000 episodes for reinforcement learning (monetization policy)
AL_EPISODES = 50000      # 50,000 episodes for active learning parameter exploration
TOTAL_RUNS = RL_EPISODES + AL_EPISODES

# =====================================================================
# 1. LTV/CAC Monetization MDP & Q-Learning
# =====================================================================
# State: (belief_level, engagement_level, proposed_price_tier)
# belief_level: 0 (Low), 1 (Medium), 2 (High)
# engagement_level: 0 (Low), 1 (Medium), 2 (High)
# price_tier: 0 (990 KRW), 1 (2,900 KRW), 2 (4,900 KRW / Subscription)
# Actions: 
# 0 = Offer Low Price Entry (990 KRW)
# 1 = Offer Premium Deep Report (2,900 KRW)
# 2 = Offer Monthly Subscription (4,900 KRW)

class SajuLtvQAgent:
    def __init__(self, lr=0.1, discount=0.9, epsilon=1.0, decay=0.9996, min_eps=0.01):
        self.lr = lr
        self.discount = discount
        self.epsilon = epsilon
        self.decay = decay
        self.min_eps = min_eps
        # Q-table shape: (3, 3, 3, 3) -> (belief, engagement, price_tier, action)
        self.q_table = np.zeros((3, 3, 3, 3))

    def get_action(self, belief, engagement, price_tier):
        if random.random() < self.epsilon:
            return random.choice([0, 1, 2])
        return np.argmax(self.q_table[belief, engagement, price_tier])

    def update(self, b, e, p, a, reward, nb, ne, np_next, done):
        best_next = np.argmax(self.q_table[nb, ne, np_next]) if not done else 0
        target = reward + (0 if done else self.discount * self.q_table[nb, ne, np_next, best_next])
        self.q_table[b, e, p, a] += self.lr * (target - self.q_table[b, e, p, a])

    def decay_epsilon(self):
        self.epsilon = max(self.min_eps, self.epsilon * self.decay)

def simulate_conversion(action, belief, engagement):
    """Simulates purchase conversion probabilities based on segment and price offered."""
    # Action 0: 990 KRW, Action 1: 2900 KRW, Action 2: 4900 KRW
    base_probs = {
        0: [0.15, 0.45, 0.75], # Low price: High conversion across belief levels
        1: [0.02, 0.15, 0.45], # Medium price: Medium conversion
        2: [0.005, 0.05, 0.20],# Subscription: Low conversion except high belief
    }
    
    prob = base_probs[action][belief]
    # Engagement multiplier
    prob = min(0.95, prob * (1.0 + engagement * 0.25))
    return random.random() < prob

def run_ltv_cac_rl_simulation(cac=1000):
    print("\n[Part 1] Running 50,000 LTV/CAC Reinforcement Learning (Q-learning) Episodes...")
    agent = SajuLtvQAgent()
    
    ltv_history = []
    cac_history = []
    rewards = []
    success_purchases = 0
    
    price_values = {0: 990, 1: 2900, 2: 4900}
    
    for episode in range(RL_EPISODES):
        # Initial user state
        belief = random.choice([0, 1, 2]) # 0=Low, 1=Med, 2=High
        engagement = random.choice([0, 1, 2])
        price_tier = random.choice([0, 1, 2])
        
        done = False
        step = 0
        user_ltv = 0
        
        while not done:
            action = agent.get_action(belief, engagement, price_tier)
            converted = simulate_conversion(action, belief, engagement)
            
            revenue = price_values[action] if converted else 0
            user_ltv += revenue
            
            # Reward: Net Margin (LTV - CAC)
            # Since CAC is fixed per user acquisition, we evaluate LTV contribution vs CAC at terminal state.
            reward = revenue / 100.0  # Normalized scale
            
            if converted:
                success_purchases += 1
                
            # State transition (engagement increases slightly on purchase)
            next_belief = belief
            next_engagement = min(2, engagement + (1 if converted else 0))
            next_price_tier = min(2, price_tier + 1)
            
            step += 1
            if step >= 3 or converted: # Terminate on purchase or after 3 steps
                done = True
                # Final evaluation: LTV should exceed CAC
                if user_ltv < cac:
                    reward -= (cac - user_ltv) / 100.0 # Penalty for losing money
                else:
                    reward += (user_ltv / cac) * 5.0    # Reward for high LTV/CAC ratio
            
            agent.update(belief, engagement, price_tier, action, reward, next_belief, next_engagement, next_price_tier, done)
            
            belief = next_belief
            engagement = next_engagement
            price_tier = next_price_tier
            
        ltv_history.append(user_ltv)
        cac_history.append(cac)
        agent.decay_epsilon()
        
    avg_ltv = np.mean(ltv_history)
    ltv_cac_ratio = avg_ltv / cac
    
    print("\n--- Q-Learning Optimal Pricing Policy ---")
    belief_labels = {0: "Low Belief ", 1: "Med Belief ", 2: "High Belief"}
    eng_labels = {0: "Low Eng", 1: "Med Eng", 2: "High Eng"}
    action_desc = {0: "990 KRW Low Entry", 1: "2,900 KRW Premium Report", 2: "4,900 KRW Subscription"}
    
    for b in [0, 1, 2]:
        for e in [0, 1, 2]:
            opt_act = np.argmax(agent.q_table[b, e, 0])
            print(f"  {belief_labels[b]} + {eng_labels[e]} => Suggest: {action_desc[opt_act]}")
            
    print(f"\nEmpirical Average LTV: {avg_ltv:.1f} KRW (with CAC: {cac} KRW)")
    print(f"Learned LTV/CAC Ratio: {ltv_cac_ratio:.3f}:1")
    return agent

# =====================================================================
# 2. Active Learning for Sustainable CAC Boundaries
# =====================================================================
def run_active_learning_cac_boundary(agent):
    print("\n[Part 2] Running 50,000 Active Learning CAC Boundary Exploration Episodes...")
    # Active learning goal: Find the maximum sustainable CAC threshold where LTV/CAC ratio >= 3.0
    # We query CAC parameter space (100 KRW to 5,000 KRW)
    
    target_ratio = 3.0
    queries = 50
    runs_per_query = 1000 # 50 * 1000 = 50,000 total runs
    
    low_cac = 100
    high_cac = 5000
    
    price_values = {0: 990, 1: 2900, 2: 4900}
    
    for q in range(queries):
        mid_cac = (low_cac + high_cac) / 2
        
        # Run simulation at mid_cac with the trained policy
        ltvs = []
        for _ in range(runs_per_query):
            belief = random.choice([0, 1, 2])
            engagement = random.choice([0, 1, 2])
            price_tier = 0
            
            done = False
            step = 0
            user_ltv = 0
            
            while not done:
                action = np.argmax(agent.q_table[belief, engagement, price_tier])
                converted = simulate_conversion(action, belief, engagement)
                
                if converted:
                    user_ltv += price_values[action]
                    
                next_belief = belief
                next_engagement = min(2, engagement + (1 if converted else 0))
                next_price_tier = min(2, price_tier + 1)
                
                step += 1
                if step >= 3 or converted:
                    done = True
                    
                belief = next_belief
                engagement = next_engagement
                price_tier = next_price_tier
                
            ltvs.append(user_ltv)
            
        avg_ltv = np.mean(ltvs)
        empirical_ratio = avg_ltv / mid_cac
        
        # Active step: adjust bounds to zoom in on the exact boundary ratio of 3.0
        if empirical_ratio >= target_ratio:
            # Sustainable! We can afford a higher CAC (push low_cac up)
            low_cac = mid_cac
        else:
            # Unsustainable (ratio < 3.0). We must lower CAC (push high_cac down)
            high_cac = mid_cac
            
    print("\n--- Active Learning CAC Sustainability Boundary Report ---")
    print(f"Goal: Achieve LTV/CAC Ratio >= {target_ratio:.1f}:1")
    print(f"Maximum Allowed CAC (Max Acquisition Spend per user): {low_cac:.1f} KRW")
    print(f"Empirical LTV at Boundary: {avg_ltv:.1f} KRW")
    print(f"Discovered LTV/CAC Ratio at Boundary: {avg_ltv / low_cac:.3f}:1")

# =====================================================================
# Main Run Execution
# =====================================================================
if __name__ == "__main__":
    print("=====================================================================")
    print("LTV/CAC Monetization Q-Learning & Active Learning Simulation")
    print("=====================================================================")
    
    # 1. Q-learning (Baseline CAC = 500 KRW for web marketing)
    agent = run_ltv_cac_rl_simulation(cac=500)
    
    # 2. Active Learning
    run_active_learning_cac_boundary(agent)
    
    print("\n=====================================================================")
    print("Simulation Complete!")
    print("=====================================================================")
